export const normalizeMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
};

export const normalizeSignedMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
};

export const formatBillingCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

export const buildConsultationBillingItem = (clinic = {}, appointment = {}) => {
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

export const buildBillingItems = (clinic = {}, appointment = {}) => {
  const billing = appointment?.billing || {};
  const savedItems = Array.isArray(billing.items) ? billing.items : [];

  if (savedItems.length > 0) {
    const consultationItem = savedItems.find((item) => item.type === 'consultation');
    const serviceItems = savedItems.filter((item) => item.type === 'service');
    return [
      consultationItem || buildConsultationBillingItem(clinic, appointment),
      ...serviceItems.map((item) => ({
        type: 'service',
        name: String(item.name || ''),
        amount: normalizeMoney(item.amount),
        sourceServiceId: String(item.sourceServiceId || '')
      }))
    ];
  }

  return [buildConsultationBillingItem(clinic, appointment)];
};

export const hasBillingRecord = (appointment) => {
  const billing = appointment?.billing || {};
  return Boolean(
    billing.receiptNumber ||
    Number(billing.totalAmount || billing.consultationFee || billing.amountPaid || 0) > 0 ||
    (Array.isArray(billing.items) && billing.items.length > 0) ||
    (Array.isArray(billing.payments) && billing.payments.length > 0)
  );
};

export const getAppointmentBillingAmounts = (appointment, clinic = {}) => {
  const billing = appointment?.billing || {};
  const items = buildBillingItems(clinic, appointment);
  const total = normalizeMoney(
    Array.isArray(billing.items) && billing.items.length > 0
      ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      : Number(billing.totalAmount || billing.consultationFee || 0)
  );
  const expectedTotal = total > 0 ? total : normalizeMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const paid = normalizeMoney(billing.amountPaid || 0);
  const balance = normalizeSignedMoney(expectedTotal - paid);

  return {
    total: expectedTotal,
    paid,
    balance
  };
};

export const getBillingStatus = (appointment, clinic = {}) => {
  const billing = appointment?.billing || {};
  const { total, paid, balance } = getAppointmentBillingAmounts(appointment, clinic);

  if (billing.paymentStatus === 'Paid' || (total > 0 && balance <= 0 && paid > 0)) return 'Fully Paid';
  if (billing.paymentStatus === 'Partially Paid' || paid > 0) return 'Partial Paid';
  if (billing.paymentStatus === 'Pending' || total > 0) return 'Unpaid';
  return 'Unbilled';
};

export const getBillingStatusClass = (status) => {
  if (status === 'Fully Paid') return 'bg-teal-50 text-teal-700 border-teal-100';
  if (status === 'Partial Paid') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'Unpaid') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};
