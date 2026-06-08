const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderChipList = (items = []) => (
  items.length > 0
    ? `<div class="chips">${items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>`
    : '<p class="muted">None recorded</p>'
);

const buildPrintableHtml = (title, content) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .page { max-width: 760px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 32px; }
      .header { border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px; }
      .clinic { font-size: 26px; font-weight: 700; color: #0f172a; }
      .meta, .muted { color: #475569; font-size: 13px; line-height: 1.6; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 16px 0 24px; }
      .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; }
      .label { color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
      .value { font-size: 14px; font-weight: 600; color: #0f172a; }
      h2 { font-size: 16px; margin: 24px 0 12px; color: #0f766e; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { padding: 6px 10px; border-radius: 999px; background: #ecfeff; border: 1px solid #bae6fd; font-size: 13px; color: #155e75; font-weight: 600; }
      .footer { margin-top: 28px; padding-top: 16px; border-top: 1px dashed #cbd5e1; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th, td { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 10px 8px; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
      @media print {
        body { background: #fff; }
        .page { padding: 20px; }
      }
    </style>
  </head>
  <body>
    <div class="page">${content}</div>
    <script>
      window.onload = () => {
        window.print();
        window.onafterprint = () => window.close();
      };
    </script>
  </body>
</html>`;

const openPrintWindow = (title, content) => {
  const printableHtml = buildPrintableHtml(title, content);
  const printableBlob = new Blob([printableHtml], { type: 'text/html' });
  const printableUrl = URL.createObjectURL(printableBlob);
  const printWindow = window.open(printableUrl, '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    const link = document.createElement('a');
    link.href = printableUrl;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.setTimeout(() => URL.revokeObjectURL(printableUrl), 60000);
  return true;
};

const buildHeader = ({ clinic = {}, appointment = {}, patient = {}, doctor = {} }) => `
  <div class="header">
    <div class="clinic">${escapeHtml(clinic.name || 'CareOPD')}</div>
    <div class="meta">${escapeHtml(clinic.address || '')}${clinic.address && clinic.phone ? ' | ' : ''}${escapeHtml(clinic.phone || '')}</div>
    <div class="meta">${escapeHtml(clinic.email || '')}</div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="label">Patient</div>
      <div class="value">${escapeHtml(patient.name || 'Unknown Patient')}</div>
      <div class="meta">${escapeHtml(patient.gender || 'U')}${patient.age ? ` | ${escapeHtml(patient.age)} Yrs` : ''}</div>
      <div class="meta">${escapeHtml(patient.phone || '')}</div>
    </div>
    <div class="card">
      <div class="label">Visit</div>
      <div class="value">${escapeHtml(appointment.date || '')} | ${escapeHtml(appointment.time || '')}</div>
      <div class="meta">Doctor: ${escapeHtml(doctor.name || 'Doctor')}</div>
      <div class="meta">Status: ${escapeHtml(appointment.status || 'Completed')}</div>
    </div>
  </div>
`;

export const printPrescriptionDocument = ({ clinic, appointment, patient, doctor, prescription }) => {
  const medicines = Array.isArray(prescription?.medicines) ? prescription.medicines : [];
  if (medicines.length === 0) return false;

  const content = `
    ${buildHeader({ clinic, appointment, patient, doctor })}
    <h2>Clinical Notes</h2>
    <div class="card">
      <div class="label">Complaints</div>
      <div class="value">${escapeHtml(prescription?.complaints || '--')}</div>
      <div class="label" style="margin-top:12px;">Diagnosis</div>
      <div class="value">${escapeHtml(prescription?.diagnosis || '--')}</div>
      <div class="label" style="margin-top:12px;">Advice</div>
      <div class="value">${escapeHtml(prescription?.advice || '--')}</div>
    </div>
    <h2>Prescription</h2>
    <table>
      <thead>
        <tr>
          <th>Medicine</th>
          <th>Schedule</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${medicines.map((medicine) => `
          <tr>
            <td>${escapeHtml(medicine.name)}</td>
            <td>${escapeHtml([medicine.route, medicine.quantity, medicine.frequency, medicine.timing, medicine.duration].filter(Boolean).join(' | '))}</td>
            <td>${escapeHtml(medicine.instructions || '--')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer meta">Generated from CareOPD consultation records.</div>
  `;

  return openPrintWindow('Prescription', content);
};

export const printLabOrderDocument = ({ clinic, appointment, patient, doctor, prescription }) => {
  const labNames = (Array.isArray(prescription?.labTests) ? prescription.labTests : [])
    .map((test) => typeof test === 'string' ? test : test?.name)
    .filter(Boolean);
  if (labNames.length === 0) return false;

  const content = `
    ${buildHeader({ clinic, appointment, patient, doctor })}
    <h2>Lab Requisition</h2>
    <div class="card">
      <div class="label">Requested Tests</div>
      ${renderChipList(labNames)}
    </div>
    <div class="footer meta">Please carry this requisition while collecting samples or visiting the lab.</div>
  `;

  return openPrintWindow('Lab Order', content);
};

export const printReceiptDocument = ({ clinic, appointment, patient, doctor }) => {
  const billing = appointment?.billing || {};
  const payments = Array.isArray(billing.payments) ? billing.payments : [];
  const items = Array.isArray(billing.items) ? billing.items : [];
  const hasReceipt = Boolean(billing.receiptNumber || billing.consultationFee > 0 || billing.totalAmount > 0 || payments.length > 0 || items.length > 0);
  if (!hasReceipt) return false;

  const content = `
    ${buildHeader({ clinic, appointment, patient, doctor })}
    <h2>Receipt</h2>
    <div class="grid">
      <div class="card">
        <div class="label">Receipt Number</div>
        <div class="value">${escapeHtml(billing.receiptNumber || '--')}</div>
        <div class="label" style="margin-top:12px;">Payment Status</div>
        <div class="value">${escapeHtml(billing.paymentStatus || 'Unbilled')}</div>
      </div>
      <div class="card">
        <div class="label">Total Payable</div>
        <div class="value">Rs ${escapeHtml(Number(billing.totalAmount || billing.consultationFee || 0).toFixed(2))}</div>
        <div class="label" style="margin-top:12px;">Paid / Balance</div>
        <div class="value">Rs ${escapeHtml(Number(billing.amountPaid || 0).toFixed(2))} / Rs ${escapeHtml(Number(billing.balanceAmount || 0).toFixed(2))}</div>
      </div>
    </div>
    <h2>Items</h2>
    ${
      items.length > 0
        ? `
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>${escapeHtml(item.name || '--')}</td>
                  <td>${escapeHtml(item.type === 'consultation' ? 'Consultation' : 'Service')}</td>
                  <td>Rs ${escapeHtml(Number(item.amount || 0).toFixed(2))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        : '<div class="card"><div class="muted">No billable items recorded yet.</div></div>'
    }
    <h2>Payments</h2>
    ${
      payments.length > 0
        ? `
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Mode</th>
                <th>Note</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((payment) => `
                <tr>
                  <td>Rs ${escapeHtml(Number(payment.amount || 0).toFixed(2))}</td>
                  <td>${escapeHtml(payment.mode || '--')}</td>
                  <td>${escapeHtml(payment.note || '--')}</td>
                  <td>${escapeHtml(payment.receivedAt ? new Date(payment.receivedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '--')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        : '<div class="card"><div class="muted">No payments recorded yet.</div></div>'
    }
    <div class="footer meta">Generated from CareOPD billing records.</div>
  `;

  return openPrintWindow('Receipt', content);
};
