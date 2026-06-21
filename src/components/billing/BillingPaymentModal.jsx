import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import API_BASE_URL from '../../config';
import { authFetch } from '../../utils/auth';
import { printReceiptDocument } from '../../utils/postConsultPrint';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const formatMoney = (value) => Number(value || 0).toFixed(2);
const normalizeMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
};
const normalizeSignedMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
};

const buildConsultationItem = (clinic = {}, appointment = {}) => {
  const billing = appointment?.billing || {};
  const consultationAmount = normalizeMoney(
    billing.consultationFee > 0 ? billing.consultationFee : clinic?.consultationFee
  );

  return {
    type: 'consultation',
    name: 'Consultation',
    amount: consultationAmount,
    sourceServiceId: ''
  };
};

const buildBillingItems = (clinic = {}, appointment = {}) => {
  const billing = appointment?.billing || {};
  const savedItems = Array.isArray(billing.items) ? billing.items : [];

  if (savedItems.length > 0) {
    const consultationItem = savedItems.find((item) => item.type === 'consultation');
    const serviceItems = savedItems.filter((item) => item.type === 'service');
    return [
      consultationItem || buildConsultationItem(clinic, appointment),
      ...serviceItems.map((item) => ({
        type: 'service',
        name: String(item.name || ''),
        amount: normalizeMoney(item.amount),
        sourceServiceId: String(item.sourceServiceId || '')
      }))
    ];
  }

  return [buildConsultationItem(clinic, appointment)];
};

const BillingPaymentModal = ({
  isOpen,
  onClose,
  clinic,
  context,
  onSaved
}) => {
  const [resolvedContext, setResolvedContext] = useState(context || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [billingItems, setBillingItems] = useState([]);
  const [isServicePickerOpen, setIsServicePickerOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [hasUserEdited, setHasUserEdited] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setResolvedContext(context || null);
  }, [context, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setHasUserEdited(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || hasUserEdited) return;

    const appointment = resolvedContext?.appointment || context?.appointment || {};
    setBillingItems(buildBillingItems(clinic, appointment));
    setAmountCollected('');
    setPaymentMode('Cash');
    setError('');
    setIsServicePickerOpen(false);
    setSelectedServiceIds([]);
  }, [resolvedContext, context, hasUserEdited, isOpen]);

  const markUserEdited = () => {
    if (!hasUserEdited) setHasUserEdited(true);
  };

  const appointment = resolvedContext?.appointment || context?.appointment || {};
  const patient = resolvedContext?.patient || context?.patient || appointment?.patientId || {};
  const doctor = resolvedContext?.doctor || context?.doctor || appointment?.doctorId || {};
  const billing = appointment?.billing || {};
  const activeServices = useMemo(
    () => (Array.isArray(clinic?.billingServices) ? clinic.billingServices.filter((service) => service.active !== false) : []),
    [clinic]
  );

  const serviceOptions = activeServices.filter((service) => (
    !billingItems.some((item) => item.type === 'service' && (
      (item.sourceServiceId && String(item.sourceServiceId) === String(service._id || '')) ||
      String(item.name).trim().toLowerCase() === String(service.name || '').trim().toLowerCase()
    ))
  ));

  const totalPayable = useMemo(
    () => normalizeMoney(billingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    [billingItems]
  );
  const amountPaid = normalizeMoney(billing.amountPaid || 0);
  const savedBalance = normalizeSignedMoney(totalPayable - amountPaid);
  const canCollectAdditionalPayment = savedBalance > 0;
  const newPaymentAmount = canCollectAdditionalPayment
    ? normalizeMoney(amountCollected === '' ? 0 : amountCollected)
    : 0;
  const projectedPaid = normalizeMoney(amountPaid + newPaymentAmount);
  const currentBalance = normalizeSignedMoney(totalPayable - projectedPaid);

  useEffect(() => {
    if (!isOpen || canCollectAdditionalPayment || amountCollected === '') return;
    setAmountCollected('');
  }, [amountCollected, canCollectAdditionalPayment, isOpen]);

  const toggleServiceSelection = (serviceId) => {
    setSelectedServiceIds((prev) => (
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    ));
  };

  const handleAddSelectedServices = () => {
    const servicesToAdd = activeServices.filter((service) => selectedServiceIds.includes(String(service._id || '')));
    if (servicesToAdd.length === 0) return;

    markUserEdited();
    setBillingItems((prev) => ([
      ...prev,
      ...servicesToAdd.map((service) => ({
        type: 'service',
        name: String(service.name || ''),
        amount: normalizeMoney(service.price),
        sourceServiceId: String(service._id || '')
      }))
    ]));
    setSelectedServiceIds([]);
    setIsServicePickerOpen(false);
  };

  const handleRemoveService = (serviceIndex) => {
    markUserEdited();
    setBillingItems((prev) => prev.filter((_, index) => index !== serviceIndex));
  };

  const handleSaveAndPrintReceipt = async () => {
    if (!appointment?._id) return;

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
      printReceiptDocument({
        clinic,
        appointment: nextContext.appointment,
        patient: nextContext.patient,
        doctor: nextContext.doctor
      });
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
      title="Billing and Payment"
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
      footer={
        <div className="flex">
          <button
            type="button"
            onClick={handleSaveAndPrintReceipt}
            disabled={isSaving}
            className="type-section-title w-full h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isSaving ? 'Saving...' : 'Save and Print Receipt'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="type-label text-slate-500 uppercase">Services & Charges</div>
            <button
              type="button"
              onClick={() => setIsServicePickerOpen((prev) => !prev)}
              className="type-label text-teal-600 bg-teal-50 border border-teal-100 px-2 py-1 rounded-lg flex items-center gap-1"
            >
              <Plus size={12} /> Add Service
            </button>
          </div>

          <div className="space-y-2">
            {billingItems.map((item, index) => (
              <div key={`${item.type}-${item.sourceServiceId || item.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_90px_auto] gap-2 items-center rounded-lg border border-slate-200 bg-white p-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 truncate">{item.name}</div>
                  <div className="text-[12px] text-slate-400 uppercase">{item.type === 'consultation' ? 'Consultation' : 'Service'}</div>
                </div>
                <div className="text-[13px] font-bold text-slate-700 text-right">Rs {formatMoney(item.amount)}</div>
                {item.type === 'service' ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveService(index)}
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
                    aria-label="Remove service"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="h-8 w-8" />
                )}
              </div>
            ))}
          </div>

          {isServicePickerOpen && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              {serviceOptions.length > 0 ? (
                <>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {serviceOptions.map((service) => {
                      const serviceId = String(service._id || '');
                      const isSelected = selectedServiceIds.includes(serviceId);
                      return (
                        <label key={serviceId || service.name} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 cursor-pointer bg-slate-50">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleServiceSelection(serviceId)}
                            className="h-4 w-4 accent-teal-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold text-slate-800 truncate">{service.name}</div>
                          </div>
                          <div className="text-[13px] font-bold text-slate-700">Rs {formatMoney(service.price)}</div>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSelectedServices}
                    disabled={selectedServiceIds.length === 0}
                    className="type-section-title w-full h-9 rounded-lg bg-slate-800 text-white disabled:opacity-60"
                  >
                    Add Selected Services
                  </button>
                </>
              ) : (
                <div className="text-[13px] text-slate-500 text-center py-2">
                  No additional clinic services are configured.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
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

        {canCollectAdditionalPayment ? (
          <>
            <div>
              <label className="type-label text-slate-600 uppercase block mb-1.5">Amount Collected</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountCollected}
                onChange={(e) => {
                  markUserEdited();
                  setAmountCollected(e.target.value);
                }}
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                placeholder="Enter amount collected"
              />
            </div>

            <div>
              <label className="type-label text-slate-600 uppercase block mb-1.5">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => {
                  markUserEdited();
                  setPaymentMode(e.target.value);
                }}
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            No amount collection is required for the current bill. A negative balance means amount to return to the patient.
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default BillingPaymentModal;
