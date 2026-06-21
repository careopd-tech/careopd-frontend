import { getLocalDateString } from './dateUtils';

export const CLINICALLY_CLOSED_STATUSES = ['Completed'];
export const TERMINAL_APPOINTMENT_STATUSES = ['Completed', 'Cancelled', 'Walked Out'];

export const hasActiveConsultation = (appt = {}) => (
  (appt.status === 'In Consultation' || Boolean(appt.consultationStartedAt)) &&
  !appt.consultationCompletedAt &&
  (appt.activeConsultationMode === 'Report Review' || !TERMINAL_APPOINTMENT_STATUSES.includes(appt.status))
);

export const hasVisitProgress = (appt = {}) => (
  hasActiveConsultation(appt) ||
  Boolean(appt.checkedInAt) ||
  Boolean(appt.consultationExitedAt)
);

export const getAppointmentUiStatus = (appt = {}, todayStr = getLocalDateString()) => {
  if (appt.status === 'Cancelled') return 'Cancelled';
  if (appt.status === 'Completed') return 'Completed';
  if (appt.status === 'Awaiting Reports') return 'Awaiting Reports';
  if (appt.status === 'Draft') return 'Draft';
  if (appt.status === 'In Consultation') return 'In Consultation';
  if (appt.status === 'Checked In') return 'Checked In';
  if (appt.status === 'Walked Out') return 'Walked Out';
  if (hasActiveConsultation(appt)) return 'In Consultation';
  if ((appt.hasConsultationDraft || appt.consultationDraft) && appt.consultationDraftSavedAt) return 'Draft';
  if (appt.checkedInAt) return 'Checked In';

  const isPast = appt.date < todayStr;
  if (isPast && (appt.status === 'Scheduled' || appt.status === 'Pending') && !hasVisitProgress(appt)) {
    return 'No-Show';
  }

  return appt.status || 'Scheduled';
};

export const hasClinicalRecordStatus = (status = '') => {
  const normalizedStatus = String(status).trim().toUpperCase();
  return normalizedStatus !== 'CANCELLED' && normalizedStatus !== 'NO SHOW' && normalizedStatus !== 'NO-SHOW';
};
