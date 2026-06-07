import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import API_BASE_URL from '../../config';
import { authFetch } from '../../utils/auth';
import { printReceiptDocument } from '../../utils/postConsultPrint';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const BillingPaymentModal = ({
  isOpen,
  onClose,
  clinic,
  context,
  onSaved
}) => {
  const [resolvedContext, setResolvedContext] = useState(context || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  useEffect(() => {
    setResolvedContext(context || null);
  }, [context]);

  useEffect(() => {
    const billing = context?.appointment?.billing || {};
    setConsultationFee(billing.consultationFee ? String(billing.consultationFee) : '');
    setAmountCollected('');
    setPaymentMode('Cash');
    setError('');
  }, [context, isOpen]);

  useEffect(() => {
    if (!isOpen || !context?.appointment?._id) return undefined;

    let isMounted = true;
    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return undefined;

    const loadLatestContext = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${API_BASE_URL}/api/appointments/visit/${context.appointment._id}/post-consult?clinicId=${clinicId}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !isMounted) return;
        setResolvedContext({
          appointment: result.appointment || context.appointment,
          patient: result.patient || context.patient || context.appointment?.patientId || {},
          doctor: result.doctor || context.doctor || context.appointment?.doctorId || {}
        });
        const latestBilling = result.appointment?.billing || {};
        setConsultationFee(latestBilling.consultationFee ? String(latestBilling.consultationFee) : '');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadLatestContext();
    return () => { isMounted = false; };
  }, [isOpen, context]);

  const appointment = resolvedContext?.appointment || context?.appointment || {};
  const patient = resolvedContext?.patient || context?.patient || appointment?.patientId || {};
  const doctor = resolvedContext?.doctor || context?.doctor || appointment?.doctorId || {};

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
          consultationFee: consultationFee === '' ? 0 : Number(consultationFee),
          payment: {
            amount: amountCollected === '' ? 0 : Number(amountCollected),
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
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
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
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-500 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-teal-600" />
            Loading billing details...
          </div>
        ) : null}

        <div>
          <label className="type-label text-slate-600 uppercase block mb-1.5">Consultation Fee</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={consultationFee}
            onChange={(e) => setConsultationFee(e.target.value)}
            className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            placeholder="Enter consultation fee"
          />
        </div>

        <div>
          <label className="type-label text-slate-600 uppercase block mb-1.5">Amount Collected</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountCollected}
            onChange={(e) => setAmountCollected(e.target.value)}
            className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            placeholder="Enter amount collected"
          />
        </div>

        <div>
          <label className="type-label text-slate-600 uppercase block mb-1.5">Payment Mode</label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          >
            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>

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
