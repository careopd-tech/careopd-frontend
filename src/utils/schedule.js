export const DEFAULT_CLINIC_START_TIME = '10:00';
export const DEFAULT_CLINIC_END_TIME = '20:00';
export const DEFAULT_CLINIC_MORNING_START_TIME = '10:00';
export const DEFAULT_CLINIC_MORNING_END_TIME = '13:00';
export const DEFAULT_CLINIC_EVENING_START_TIME = '17:00';
export const DEFAULT_CLINIC_EVENING_END_TIME = '20:00';
export const DEFAULT_APPOINTMENT_WINDOW_MINUTES = 15;
export const FULL_DAY_START_TIME = '00:00';
export const FULL_DAY_END_TIME = '23:59';
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

export const formatClinicHoursLabel = (start, end, open24Hours = false) => {
  if (open24Hours) return 'Open 24 Hours';
  const safeStart = normalizeTimeValue(start, DEFAULT_CLINIC_START_TIME);
  const safeEnd = normalizeTimeValue(end, DEFAULT_CLINIC_END_TIME);
  return `${formatTimeLabel(safeStart)} - ${formatTimeLabel(safeEnd)}`;
};

export const buildClinicShiftWindows = (clinic = {}) => {
  const open24Hours = clinic?.open24Hours === true;
  if (open24Hours) {
    return [{ start: FULL_DAY_START_TIME, end: FULL_DAY_END_TIME }];
  }

  const morningStart = normalizeTimeValue(clinic.morningStart, normalizeTimeValue(clinic.workingHoursStart, DEFAULT_CLINIC_MORNING_START_TIME));
  const morningEnd = normalizeTimeValue(clinic.morningEnd, normalizeTimeValue(clinic.workingHoursEnd, DEFAULT_CLINIC_MORNING_END_TIME));
  const eveningStart = normalizeTimeValue(clinic.eveningStart, DEFAULT_CLINIC_EVENING_START_TIME);
  const eveningEnd = normalizeTimeValue(clinic.eveningEnd, DEFAULT_CLINIC_EVENING_END_TIME);
  const shifts = [];

  if (morningStart && morningEnd) {
    shifts.push({ start: morningStart, end: morningEnd });
  }

  if (eveningStart && eveningEnd) {
    shifts.push({ start: eveningStart, end: eveningEnd });
  }

  if (shifts.length === 0) {
    shifts.push({ start: DEFAULT_CLINIC_MORNING_START_TIME, end: DEFAULT_CLINIC_MORNING_END_TIME });
    shifts.push({ start: DEFAULT_CLINIC_EVENING_START_TIME, end: DEFAULT_CLINIC_EVENING_END_TIME });
  }

  return shifts;
};

export const formatClinicShiftSummary = (shifts = [], open24Hours = false) => {
  if (open24Hours) return 'Open 24 Hours';
  return shifts
    .map((shift) => `${formatTimeLabel(shift.start)} - ${formatTimeLabel(shift.end)}`)
    .join(', ');
};

export const getClinicSchedule = (clinic = {}) => {
  const open24Hours = clinic?.open24Hours === true;
  const shifts = buildClinicShiftWindows(clinic);
  const morningStart = open24Hours ? '' : (shifts[0]?.start || DEFAULT_CLINIC_START_TIME);
  const morningEnd = open24Hours ? '' : (shifts[0]?.end || DEFAULT_CLINIC_END_TIME);
  const eveningStart = open24Hours ? '' : (shifts[1]?.start || '');
  const eveningEnd = open24Hours ? '' : (shifts[1]?.end || '');
  const workingHoursStart = shifts[0]?.start || DEFAULT_CLINIC_START_TIME;
  const workingHoursEnd = shifts[shifts.length - 1]?.end || DEFAULT_CLINIC_END_TIME;
  const appointmentWindowMinutes = normalizeAppointmentWindow(clinic.appointmentWindowMinutes);

  return {
    open24Hours,
    morningStart,
    morningEnd,
    eveningStart,
    eveningEnd,
    shifts,
    workingHoursStart,
    workingHoursEnd,
    appointmentWindowMinutes,
    hours: formatClinicShiftSummary(shifts, open24Hours)
  };
};

export const formatClinicScheduleSummary = (clinic = {}) => {
  const schedule = getClinicSchedule(clinic);
  return `${schedule.hours} • ${schedule.appointmentWindowMinutes} min slots`;
};

export const isSoloClinic = (clinic = {}) => clinic?.type === 'Solo';

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

export const validateClinicSchedule = ({
  workingHoursStart,
  workingHoursEnd,
  appointmentWindowMinutes,
  open24Hours,
  morningStart,
  morningEnd,
  eveningStart,
  eveningEnd
}) => {
  if (open24Hours === true) {
    const normalizedWindow = normalizeAppointmentWindow(appointmentWindowMinutes);
    if (Number(appointmentWindowMinutes) !== normalizedWindow) {
      return 'Appointment window must be between 5 and 120 minutes in 5-minute steps.';
    }
    return '';
  }

  const resolvedMorningStart = normalizeTimeValue(morningStart, normalizeTimeValue(workingHoursStart, ''));
  const resolvedMorningEnd = normalizeTimeValue(morningEnd, normalizeTimeValue(workingHoursEnd, ''));
  const resolvedEveningStart = normalizeTimeValue(eveningStart, '');
  const resolvedEveningEnd = normalizeTimeValue(eveningEnd, '');

  if (!TIME_VALUE_REGEX.test(String(resolvedMorningStart || ''))) {
    return 'Enter a valid morning start time.';
  }

  if (!TIME_VALUE_REGEX.test(String(resolvedMorningEnd || ''))) {
    return 'Enter a valid morning end time.';
  }

  if (timeToMinutes(resolvedMorningStart) >= timeToMinutes(resolvedMorningEnd)) {
    return 'Morning shift end time must be later than start time.';
  }

  if ((resolvedEveningStart && !resolvedEveningEnd) || (!resolvedEveningStart && resolvedEveningEnd)) {
    return 'Evening shift must include both start and end time.';
  }

  if (resolvedEveningStart && resolvedEveningEnd) {
    if (timeToMinutes(resolvedMorningStart) >= timeToMinutes(resolvedEveningStart)) {
      return 'Evening shift must be later than the morning shift.';
    }

    if (timeToMinutes(resolvedMorningEnd) > timeToMinutes(resolvedEveningStart)) {
      return 'Evening shift cannot overlap the morning shift.';
    }

    if (!TIME_VALUE_REGEX.test(String(resolvedEveningStart || '')) || !TIME_VALUE_REGEX.test(String(resolvedEveningEnd || ''))) {
      return 'Enter valid evening shift timings.';
    }

    if (timeToMinutes(resolvedEveningStart) >= timeToMinutes(resolvedEveningEnd)) {
      return 'Evening shift end time must be later than start time.';
    }
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
  followsClinicSchedule,
  clinic
}) => {
  if (isSoloClinic(clinic) || followsClinicSchedule === true) return '';
  const schedule = getClinicSchedule(clinic);

  if (!morningStart || !morningEnd) {
    return 'Morning working hours are required.';
  }

  if ((eveningStart && !eveningEnd) || (!eveningStart && eveningEnd)) {
    return 'Evening working hours must include both start and end time.';
  }

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

    const fitsWithinClinicShift = schedule.shifts.some((shift) => (
      startMinutes >= timeToMinutes(shift.start) &&
      endMinutes <= timeToMinutes(shift.end)
    ));

    if (!fitsWithinClinicShift) {
      return `${label} working hours must stay within clinic working hours.`;
    }

    return '';
  };

  const morningError = validateShift('Morning', morningStart, morningEnd);
  if (morningError) return morningError;

  const eveningError = validateShift('Evening', eveningStart, eveningEnd);
  if (eveningError) return eveningError;

  if (eveningStart && timeToMinutes(morningStart) >= timeToMinutes(eveningStart)) {
    return 'Evening working hours must be later than morning shift.';
  }

  if (eveningStart && timeToMinutes(morningEnd) > timeToMinutes(eveningStart)) {
    return 'Evening working hours cannot overlap morning shift.';
  }

  return '';
};

export const getDoctorShiftWindows = (doctor = {}, clinic = {}) => {
  const schedule = getClinicSchedule(clinic);
  if (isSoloClinic(clinic) || doctor?.followsClinicSchedule === true) {
    return schedule.shifts;
  }
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
    return schedule.shifts;
  }

  return shifts;
};

export const isTimeWithinDoctorShift = (time, shifts = []) => {
  return shifts.some((shift) => time >= shift.start && time < shift.end);
};
