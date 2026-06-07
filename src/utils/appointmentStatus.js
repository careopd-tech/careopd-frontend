import { getLocalDateString } from './dateUtils';

export const CLINICALLY_CLOSED_STATUSES = ['Completed', 'Tests Recommended'];
export const TERMINAL_APPOINTMENT_STATUSES = ['Completed', 'Tests Recommended', 'Cancelled', 'Left Early'];

export const hasActiveConsultation = (appt = {}) => (
  Boolean(appt.consultationStartedAt) &&
  !appt.consultationCompletedAt &&
  (appt.activeConsultationMode === 'Addendum' || !TERMINAL_APPOINTMENT_STATUSES.includes(appt.status))
);

export const hasVisitProgress = (appt = {}) => (
  hasActiveConsultation(appt) ||
  Boolean(appt.checkedInAt) ||
  Boolean(appt.consultationExitedAt)
);

export const getAppointmentUiStatus = (appt = {}, todayStr = getLocalDateString()) => {
  if (appt.status === 'Cancelled') return 'Cancelled';
  if (appt.status === 'Completed' || appt.status === 'Done') return 'Completed';
  if (appt.status === 'Tests Recommended') return 'Test Recommended';
  if (appt.status === 'Awaiting Reports') return 'Awaiting Reports';
  if (appt.status === 'Left Early') return 'Walked Out';
  if (hasActiveConsultation(appt)) return 'In Consultation';
  if (appt.consultationDraft && appt.consultationDraftSavedAt) return 'Draft';
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
