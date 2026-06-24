import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, FlaskConical, Loader2, Printer, ReceiptText, Wallet } from 'lucide-react';
import Modal from '../ui/Modal';
import API_BASE_URL from '../../config';
import { authFetch } from '../../utils/auth';
import { printLabOrderDocument, printPrescriptionDocument, printReceiptDocument } from '../../utils/postConsultPrint';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const PostConsultActionsModal = ({
  isOpen,
  onClose,
  clinic,
  doctor,
  consultationResult
}) => {
  const initialContext = useMemo(() => ({
    appointment: consultationResult?.appointment || {},
    patient: consultationResult?.patient || consultationResult?.appointment?.patientId || {},
    doctor: doctor || consultationResult?.doctor || consultationResult?.appointment?.doctorId || {},
    prescription: consultationResult?.prescription || {}
  }), [consultationResult, doctor]);

  const [context, setContext] = useState(initialContext);
  const [isLoading, setIsLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [isBillingSaving, setIsBillingSaving] = useState(false);
  const [consultationFee, setConsultationFee] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentNote, setPaymentNote] = useState('');

  useEffect(() => {
    setContext(initialContext);
  }, [initialContext]);

  useEffect(() => {
    const billing = initialContext.appointment?.billing || {};
    setConsultationFee(billing.consultationFee ? String(billing.consultationFee) : '');
    setPaymentAmount('');
    setPaymentMode('Cash');
    setPaymentNote('');
    setBillingError('');
  }, [initialContext, isOpen]);

  useEffect(() => {
    if (!isOpen || !context?.appointment?._id) return undefined;

    let isMounted = true;
    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return undefined;

    const fetchPostConsultContext = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${API_BASE_URL}/api/appointments/visit/${context.appointment._id}/post-consult?clinicId=${clinicId}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !isMounted) return;
        setContext({
          appointment: result.appointment || context.appointment,
          patient: result.patient || context.patient,
          doctor: result.doctor || context.doctor,
          prescription: result.prescription || context.prescription || {}
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPostConsultContext();
    return () => { isMounted = false; };
  }, [isOpen, context?.appointment?._id]);

  const appointment = context?.appointment || {};
  const patient = context?.patient || appointment?.patientId || {};
  const resolvedDoctor = context?.doctor || doctor || consultationResult?.doctor || appointment?.doctorId || {};
  const prescription = context?.prescription || {};
  const billing = appointment?.billing || {};
  const medicines = Array.isArray(prescription?.medicines) ? prescription.medicines : [];
  const labs = Array.isArray(prescription?.labTests) ? prescription.labTests : [];
  const hasPrescription = medicines.length > 0;
  const hasLabOrder = labs.length > 0;
  const hasReceipt = Boolean(billing.receiptNumber || Number(billing.consultationFee || 0) > 0 || (billing.payments || []).length > 0);

  const handlePrintPrescription = () => {
    if (!hasPrescription) return;
    printPrescriptionDocument({
      clinic,
      appointment,
      patient,
      doctor: resolvedDoctor,
      prescription
    });
  };

  const handlePrintLabOrder = () => {
    if (!hasLabOrder) return;
    printLabOrderDocument({
      clinic,
      appointment,
      patient,
      doctor: resolvedDoctor,
      prescription
    });
  };

  const handlePrintReceipt = () => {
    if (!hasReceipt) return;
    printReceiptDocument({
      clinic,
      appointment,
      patient,
      doctor: resolvedDoctor
    });
  };

  const handleSaveBilling = async () => {
    if (!appointment?._id) return;

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;

    setBillingError('');
    setIsBillingSaving(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appointment._id}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          consultationFee: consultationFee === '' ? 0 : Number(consultationFee),
          payment: {
            amount: paymentAmount === '' ? 0 : Number(paymentAmount),
            mode: paymentMode,
            note: paymentNote
          }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBillingError(result.error || 'Failed to update billing.');
        return;
      }

      setContext((prev) => ({
        ...prev,
        appointment: result.appointment || prev.appointment
      }));
      setConsultationFee(result.appointment?.billing?.consultationFee ? String(result.appointment.billing.consultationFee) : '');
      setPaymentAmount('');
      setPaymentMode('Cash');
      setPaymentNote('');
    } catch (err) {
      setBillingError('Failed to update billing.');
    } finally {
      setIsBillingSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Post-Consult Actions"
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="type-section-title w-full h-9 bg-slate-800 text-white rounded-lg"
        >
          Done
        </button>
      }
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-600 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-teal-600" />
            Loading latest visit details...
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="type-label text-slate-600 uppercase">Patient</div>
          <div className="text-[16px] font-bold text-slate-900 mt-1">{patient?.name || 'Unknown Patient'}</div>
          <div className="type-secondary text-slate-600 mt-1">
            {patient?.gender || 'U'}{patient?.age ? ` | ${patient.age} Yrs` : ''}{patient?.phone ? ` | ${patient.phone}` : ''}
          </div>
        </div>

        <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
          <div className="type-label text-teal-700 uppercase">Visit Status</div>
          <div className="text-[15px] font-bold text-teal-900 mt-1">{appointment?.status || consultationResult?.statusLabel || 'Completed'}</div>
          <div className="type-secondary text-teal-700 mt-1">
            {appointment?.date || ''}{appointment?.time ? ` | ${appointment.time}` : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-slate-600" />
            <div className="type-label text-slate-600 uppercase">Documents</div>
          </div>

          {hasPrescription || hasLabOrder ? (
            <div className={`grid gap-2 ${hasPrescription && hasLabOrder ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {hasPrescription && (
                <button
                  type="button"
                  onClick={handlePrintPrescription}
                  className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-slate-50"
                >
                  <Printer size={16} /> Print Prescription
                </button>
              )}
              {hasLabOrder && (
                <button
                  type="button"
                  onClick={handlePrintLabOrder}
                  className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-slate-50"
                >
                  <FlaskConical size={16} /> Print Lab Order
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-[13px] text-slate-600">
              No prescription or lab order was added in this consultation.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-slate-600" />
            <div className="type-label text-slate-600 uppercase">Billing & Payment</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[12px] text-slate-400 uppercase font-bold">Fee</div>
              <div className="text-[14px] font-bold text-slate-800">Rs {Number(billing.consultationFee || 0).toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[12px] text-slate-400 uppercase font-bold">Status</div>
              <div className="text-[14px] font-bold text-slate-800">{billing.paymentStatus || 'Unbilled'}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[12px] text-slate-400 uppercase font-bold">Paid</div>
              <div className="text-[14px] font-bold text-slate-800">Rs {Number(billing.amountPaid || 0).toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[12px] text-slate-400 uppercase font-bold">Balance</div>
              <div className="text-[14px] font-bold text-slate-800">Rs {Number(billing.balanceAmount || 0).toFixed(2)}</div>
            </div>
          </div>

          {billing.receiptNumber ? (
            <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-[13px] text-teal-800 font-medium">
              Receipt No: {billing.receiptNumber}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase">Consultation Fee</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={consultationFee}
                onChange={(event) => setConsultationFee(event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase">Payment Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase">Payment Note</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Optional note"
              />
            </div>
          </div>

          {billingError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {billingError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSaveBilling}
              disabled={isBillingSaving}
              className="h-11 rounded-xl bg-teal-600 text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-teal-700 disabled:opacity-70"
            >
              {isBillingSaving ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              Save Billing / Payment
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              disabled={!hasReceipt}
              className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ReceiptText size={16} /> Print Receipt
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PostConsultActionsModal;
