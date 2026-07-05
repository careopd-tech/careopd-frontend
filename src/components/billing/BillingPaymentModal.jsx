import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import API_BASE_URL from '../../config';
import { authFetch } from '../../utils/auth';
import { buildBillingItems, normalizeMoney, normalizeSignedMoney } from '../../utils/billingUtils';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const formatMoney = (value) => Number(value || 0).toFixed(2);

const normalizeBillingItemsForCompare = (items = []) => (
  items.map((item) => ({
    type: item.type || '',
    name: String(item.name || ''),
    amount: normalizeMoney(item.amount),
    sourceServiceId: String(item.sourceServiceId || '')
  }))
);

const BillingPaymentModal = ({
  isOpen,
  onClose,
  clinic,
  context,
  onSaved
}) => {
  const [resolvedContext, setResolvedContext] = useState(context || null);
  const [resolvedClinic, setResolvedClinic] = useState(clinic || {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [billingItems, setBillingItems] = useState([]);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isReceiptsOpen, setIsReceiptsOpen] = useState(false);
  const hasUserEditedRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const nextContext = context || null;
      const nextClinic = clinic || {};
      const appointment = nextContext?.appointment || {};

      setResolvedContext(nextContext);
      setResolvedClinic(nextClinic);
      setBillingItems(buildBillingItems(nextClinic, appointment));
      setAmountCollected('');
      setPaymentMode('Cash');
      setIsServicesOpen(false);
      setIsReceiptsOpen(false);
      setError('');
      hasUserEditedRef.current = false;
    }

    if (!isOpen && wasOpenRef.current) {
      hasUserEditedRef.current = false;
    }

    wasOpenRef.current = isOpen;
  }, [clinic, context, isOpen]);

  const markUserEdited = useCallback(() => {
    hasUserEditedRef.current = true;
  }, []);

  const appointment = resolvedContext?.appointment || context?.appointment || {};
  const patient = resolvedContext?.patient || context?.patient || appointment?.patientId || {};
  const doctor = resolvedContext?.doctor || context?.doctor || appointment?.doctorId || {};
  const billing = appointment?.billing || {};
  const payments = Array.isArray(billing.payments) ? billing.payments : [];
  const activeServices = useMemo(
    () => (Array.isArray(resolvedClinic?.billingServices) ? resolvedClinic.billingServices.filter((service) => service.active !== false) : []),
    [resolvedClinic]
  );

  const totalPayable = useMemo(
    () => normalizeMoney(billingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    [billingItems]
  );
  const consultationItem = useMemo(
    () => billingItems.find((item) => item.type === 'consultation') || { name: 'Consultation', amount: 0 },
    [billingItems]
  );
  const serviceSubtotal = useMemo(
    () => normalizeMoney(billingItems
      .filter((item) => item.type === 'service')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    [billingItems]
  );
  const receiptsSubtotal = useMemo(
    () => normalizeMoney(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
    [payments]
  );
  const amountPaid = normalizeMoney(billing.amountPaid || 0);
  const savedBalance = normalizeSignedMoney(totalPayable - amountPaid);
  const canCollectAdditionalPayment = savedBalance > 0;
  const canReturnPayment = savedBalance < 0;
  const enteredPaymentAmount = normalizeMoney(amountCollected === '' ? 0 : amountCollected);
  const newPaymentAmount = canCollectAdditionalPayment
    ? enteredPaymentAmount
    : canReturnPayment
      ? -Math.min(enteredPaymentAmount, Math.abs(savedBalance))
      : 0;
  const projectedPaid = normalizeMoney(amountPaid + newPaymentAmount);
  const currentBalance = normalizeSignedMoney(totalPayable - projectedPaid);
  const hasBillingItemsChanged = useMemo(() => {
    const savedItems = buildBillingItems(resolvedClinic, appointment);
    return JSON.stringify(normalizeBillingItemsForCompare(savedItems)) !== JSON.stringify(normalizeBillingItemsForCompare(billingItems));
  }, [appointment, billingItems, resolvedClinic]);
  const hasPaymentChange = newPaymentAmount !== 0;
  const hasUnsavedChanges = hasBillingItemsChanged || hasPaymentChange;

  const handleAmountCollectedChange = useCallback((event) => {
    markUserEdited();
    const nextValue = String(event.target.value || '').replace(/[^\d.]/g, '');
    const [whole = '', ...decimalParts] = nextValue.split('.');
    const sanitizedValue = decimalParts.length > 0
      ? `${whole}.${decimalParts.join('').slice(0, 2)}`
      : whole;
    const enteredAmount = Number(sanitizedValue);
    if (canReturnPayment && Number.isFinite(enteredAmount)) {
      const maxReturnAmount = Math.abs(savedBalance);
      if (enteredAmount > maxReturnAmount) {
        setAmountCollected(String(maxReturnAmount));
        return;
      }
    }
    setAmountCollected(sanitizedValue);
  }, [canReturnPayment, markUserEdited, savedBalance]);

  const handlePaymentModeChange = useCallback((event) => {
    markUserEdited();
    setPaymentMode(event.target.value);
  }, [markUserEdited]);

  const findServiceItemIndex = useCallback((items, service) => {
    const serviceId = String(service?._id || '');
    const serviceName = String(service?.name || '').trim().toLowerCase();
    return items.findIndex((item) => item.type === 'service' && (
      (serviceId && String(item.sourceServiceId || '') === serviceId) ||
      String(item.name || '').trim().toLowerCase() === serviceName
    ));
  }, []);

  const isServiceAdded = useCallback((service) => findServiceItemIndex(billingItems, service) >= 0, [billingItems, findServiceItemIndex]);

  const toggleService = (service) => {
    markUserEdited();
    setBillingItems((prev) => {
      const existingIndex = findServiceItemIndex(prev, service);
      if (existingIndex >= 0) {
        return prev.filter((_, index) => index !== existingIndex);
      }

      return [
        ...prev,
        {
          type: 'service',
          name: String(service.name || ''),
          amount: normalizeMoney(service.price),
          sourceServiceId: String(service._id || '')
        }
      ];
    });
  };

  const handleSaveBilling = async () => {
    if (!appointment?._id) return;
    if (!hasUnsavedChanges) return;

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;

    setError('');
    setIsSaving(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appointment._id}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          items: billingItems,
          payment: {
            amount: newPaymentAmount,
            mode: paymentMode
          }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || 'Failed to update billing.');
        return;
      }

      const nextContext = {
        appointment: result.appointment || appointment,
        patient: result.appointment?.patientId || patient,
        doctor: result.appointment?.doctorId || doctor
      };
      setResolvedContext(nextContext);
      onSaved?.(nextContext.appointment);
      onClose();
    } catch (err) {
      setError('Failed to update billing.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payments & Receipts"
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
      bodyClassName="p-4 overflow-y-auto overscroll-contain"
      footer={
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => handleSaveBilling()}
            disabled={isSaving || !hasUnsavedChanges}
            className="type-section-title h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-teal-100 bg-white p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-800 truncate">{consultationItem.name || 'Consultation'}</div>
              <div className="text-[12px] text-teal-600 uppercase">Fixed consultation fee</div>
            </div>
            <div className="text-[14px] font-bold text-slate-800">Rs {formatMoney(consultationItem.amount)}</div>
            <ChevronDown size={15} className="invisible text-slate-400" aria-hidden="true" />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setIsServicesOpen((value) => !value)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            aria-expanded={isServicesOpen}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-800 truncate">Additional Services</div>
              <div className="text-[12px] text-teal-600 uppercase">{activeServices.length} Investigations & Procedures</div>
            </div>
            <div className="text-[14px] font-bold text-slate-800">Rs {formatMoney(serviceSubtotal)}</div>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${isServicesOpen ? 'rotate-180' : ''}`} />
          </button>
          {isServicesOpen && (
            <div className="border-t border-slate-100">
              {activeServices.length > 0 ? (
                <div className="overflow-y-auto" style={{ maxHeight: 'min(11rem, 28vh)' }}>
                {activeServices.map((service, index) => {
                  const serviceId = String(service._id || service.name || index);
                  const isAdded = isServiceAdded(service);
                  return (
                    <div
                      key={serviceId}
                      className={`grid grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-2 px-3 py-2 ${
                        index > 0 ? 'border-t border-slate-100' : ''
                      }`}
                    >
                      <div className="min-w-0 text-[13px] font-bold text-slate-800 truncate">{service.name}</div>
                      <div className="text-[13px] font-bold text-slate-700 text-right">Rs {formatMoney(service.price)}</div>
                      <button
                        type="button"
                        onClick={() => toggleService(service)}
                        aria-pressed={isAdded}
                        aria-label={`${isAdded ? 'Remove' : 'Add'} ${service.name}`}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          isAdded ? 'bg-teal-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            isAdded ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
                </div>
              ) : (
                <div className="px-3 py-3 text-[13px] text-slate-500">No additional services configured.</div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setIsReceiptsOpen((value) => !value)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            aria-expanded={isReceiptsOpen}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-800 truncate">Receipts</div>
              <div className="text-[12px] text-teal-600 uppercase">{payments.length} payment{payments.length === 1 ? '' : 's'} recorded</div>
            </div>
            <div className="text-[14px] font-bold text-slate-800">Rs {formatMoney(receiptsSubtotal)}</div>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${isReceiptsOpen ? 'rotate-180' : ''}`} />
          </button>
          {isReceiptsOpen && (
            <div className="border-t border-slate-100">
              {payments.length > 0 ? (
                <div className="overflow-y-auto" style={{ maxHeight: 'min(10.5rem, 24vh)' }}>
                    {payments.map((payment, index) => (
                      <div
                        key={`${payment.receivedAt || 'payment'}-${index}`}
                        className={`grid grid-cols-[minmax(0,1.6fr)_minmax(3.25rem,0.55fr)_minmax(4.75rem,0.7fr)] items-center gap-2 px-3 py-2 ${
                          index > 0 ? 'border-t border-slate-100' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold leading-snug text-slate-800">
                            {payment.receivedAt ? new Date(payment.receivedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            }) : '--'}
                          </div>
                        </div>
                        <div className="text-[13px] font-bold text-slate-600 truncate text-right">{payment.mode || '--'}</div>
                        <div className="text-[13px] font-bold text-slate-800 text-right">Rs {formatMoney(payment.amount)}</div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="px-3 py-3 text-[13px] text-slate-500">No payments recorded for this appointment.</div>
              )}
            </div>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[12px] text-slate-400 uppercase font-bold">Total</div>
            <div className="text-[14px] font-bold text-slate-800 mt-1">Rs {formatMoney(totalPayable)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[12px] text-slate-400 uppercase font-bold">Paid</div>
            <div className="text-[14px] font-bold text-slate-800 mt-1">Rs {formatMoney(projectedPaid)}</div>
            {newPaymentAmount > 0 ? (
              <div className="text-[11px] text-teal-600 mt-0.5">Includes Rs {formatMoney(newPaymentAmount)} now</div>
            ) : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[12px] text-slate-400 uppercase font-bold">Balance</div>
            <div className="text-[14px] font-bold text-slate-800 mt-1">Rs {formatMoney(currentBalance)}</div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[minmax(0,40fr)_minmax(0,5fr)_minmax(0,55fr)]">
          <div className="min-w-0">
            <label className="type-label text-slate-600 uppercase block mb-1.5">
              {canReturnPayment ? 'Amount Returned' : 'Amount Collected'}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountCollected}
              onChange={handleAmountCollectedChange}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder="Enter amount"
            />
          </div>

          <div aria-hidden="true" />

          <div className="min-w-0">
            <label className="type-label text-slate-600 uppercase block mb-1.5">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={handlePaymentModeChange}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>
        </div>

        {!canCollectAdditionalPayment ? (
          <div className="shrink-0 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            {currentBalance < 0
              ? 'Negative Balance! Amount refund to the patient.'
              : 'No payment is due.'}
          </div>
        ) : null}

        {error ? (
          <div className="shrink-0 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default BillingPaymentModal;
