export const DEFAULT_CLINIC_START_TIME = '09:00';
export const DEFAULT_CLINIC_END_TIME = '17:00';
export const DEFAULT_APPOINTMENT_WINDOW_MINUTES = 15;
export const APPOINTMENT_WINDOW_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

const TIME_VALUE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const normalizeTimeValue = (value, fallback = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  return TIME_VALUE_REGEX.test(normalized) ? normalized : fallback;
};

export const normalizeAppointmentWindow = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 120 || parsed % 5 !== 0) {
    return DEFAULT_APPOINTMENT_WINDOW_MINUTES;
  }
  return parsed;
};

export const timeToMinutes = (value) => {
  if (!TIME_VALUE_REGEX.test(String(value || ''))) return NaN;
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
};

export const formatTimeLabel = (value) => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return '';

  const [hours, minutes] = normalized.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

export const formatClinicHoursLabel = (start, end) => {
  const safeStart = normalizeTimeValue(start, DEFAULT_CLINIC_START_TIME);
  const safeEnd = normalizeTimeValue(end, DEFAULT_CLINIC_END_TIME);
  return `${formatTimeLabel(safeStart)} - ${formatTimeLabel(safeEnd)}`;
};

export const getClinicSchedule = (clinic = {}) => {
  const workingHoursStart = normalizeTimeValue(clinic.workingHoursStart, DEFAULT_CLINIC_START_TIME);
  const workingHoursEnd = normalizeTimeValue(clinic.workingHoursEnd, DEFAULT_CLINIC_END_TIME);
  const appointmentWindowMinutes = normalizeAppointmentWindow(clinic.appointmentWindowMinutes);

  return {
    workingHoursStart,
    workingHoursEnd,
    appointmentWindowMinutes,
    hours: formatClinicHoursLabel(workingHoursStart, workingHoursEnd)
  };
};

export const formatClinicScheduleSummary = (clinic = {}) => {
  const schedule = getClinicSchedule(clinic);
  return `${schedule.hours} • ${schedule.appointmentWindowMinutes} min slots`;
};

export const generateTimeSlots = (slotMinutes = DEFAULT_APPOINTMENT_WINDOW_MINUTES) => {
  const step = normalizeAppointmentWindow(slotMinutes);
  const slots = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mins = String(minutes % 60).padStart(2, '0');
    slots.push(`${hours}:${mins}`);
  }

  return slots;
};

export const validateClinicSchedule = ({ workingHoursStart, workingHoursEnd, appointmentWindowMinutes }) => {
  if (!TIME_VALUE_REGEX.test(String(workingHoursStart || ''))) {
    return 'Enter a valid clinic start time.';
  }

  if (!TIME_VALUE_REGEX.test(String(workingHoursEnd || ''))) {
    return 'Enter a valid clinic end time.';
  }

  if (timeToMinutes(workingHoursStart) >= timeToMinutes(workingHoursEnd)) {
    return 'Clinic end time must be later than clinic start time.';
  }

  const normalizedWindow = normalizeAppointmentWindow(appointmentWindowMinutes);
  if (Number(appointmentWindowMinutes) !== normalizedWindow) {
    return 'Appointment window must be between 5 and 120 minutes in 5-minute steps.';
  }

  return '';
};

export const validateDoctorWorkingHours = ({
  morningStart,
  morningEnd,
  eveningStart,
  eveningEnd,
  clinic
}) => {
  const schedule = getClinicSchedule(clinic);

  if (!morningStart || !morningEnd) {
    return 'Primary working hours are required.';
  }

  if ((eveningStart && !eveningEnd) || (!eveningStart && eveningEnd)) {
    return 'Secondary working hours must include both start and end time.';
  }

  const clinicStartMinutes = timeToMinutes(schedule.workingHoursStart);
  const clinicEndMinutes = timeToMinutes(schedule.workingHoursEnd);

  const validateShift = (label, start, end) => {
    if (!start && !end) return '';
    if (!TIME_VALUE_REGEX.test(start) || !TIME_VALUE_REGEX.test(end)) {
      return `${label} working hours are invalid.`;
    }

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes >= endMinutes) {
      return `${label} end time must be later than start time.`;
    }

    if (startMinutes < clinicStartMinutes || endMinutes > clinicEndMinutes) {
      return `${label} working hours must stay within clinic working hours.`;
    }

    return '';
  };

  const primaryError = validateShift('Primary', morningStart, morningEnd);
  if (primaryError) return primaryError;

  const secondaryError = validateShift('Secondary', eveningStart, eveningEnd);
  if (secondaryError) return secondaryError;

  if (eveningStart && timeToMinutes(morningEnd) > timeToMinutes(eveningStart)) {
    return 'Secondary working hours cannot overlap the primary shift.';
  }

  return '';
};

export const getDoctorShiftWindows = (doctor = {}, clinic = {}) => {
  const schedule = getClinicSchedule(clinic);
  const morningStart = normalizeTimeValue(doctor.morningStart, '');
  const morningEnd = normalizeTimeValue(doctor.morningEnd, '');
  const eveningStart = normalizeTimeValue(doctor.eveningStart, '');
  const eveningEnd = normalizeTimeValue(doctor.eveningEnd, '');

  const shifts = [];

  if (morningStart && morningEnd) {
    shifts.push({ start: morningStart, end: morningEnd });
  }

  if (eveningStart && eveningEnd) {
    shifts.push({ start: eveningStart, end: eveningEnd });
  }

  if (shifts.length === 0) {
    shifts.push({
      start: schedule.workingHoursStart,
      end: schedule.workingHoursEnd
    });
  }

  return shifts;
};

export const isTimeWithinDoctorShift = (time, shifts = []) => {
  return shifts.some((shift) => time >= shift.start && time < shift.end);
};
