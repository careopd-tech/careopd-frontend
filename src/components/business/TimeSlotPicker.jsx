import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import {
  generateTimeSlots,
  getClinicSchedule,
  getDoctorShiftWindows,
  isTimeWithinDoctorShift,
  timeToMinutes
} from '../../utils/schedule';

const TimeSlotPicker = ({ selectedTime, onSelect, doctor, date, appointments, clinic }) => {
  if (!doctor) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50">
        <Clock className="mx-auto text-slate-300 mb-2" size={24} />
        <p className="text-[12px] text-slate-400 font-medium">Select a doctor to view working hours</p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = date === todayStr;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const clinicSchedule = useMemo(() => getClinicSchedule(clinic || {}), [clinic]);

  const parseTime = (timeStr) => {
    if (!timeStr) return { h: 0, m: 0, str24: '00:00' };
    let [time, modifier] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (modifier === 'PM' && h !== 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    const str24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { h, m, str24 };
  };

  const processedSlots = useMemo(() => {
    if (!date) return [];

    const currentDocId = doctor._id || doctor.id;
    const doctorShifts = getDoctorShiftWindows(doctor, clinicSchedule);
    const baseSlots = generateTimeSlots(clinicSchedule.appointmentWindowMinutes);

    const bookedTimes = appointments
      .filter(a => {
        const apptDoctorId = a.doctorId && typeof a.doctorId === 'object' ? a.doctorId._id : a.doctorId;
        return String(apptDoctorId) === String(currentDocId) && a.date === date && a.status !== 'Cancelled';
      })
      .map(a => a.time);

    const slotTimes = [...new Set([
      ...baseSlots,
      ...bookedTimes,
      ...(selectedTime ? [selectedTime] : [])
    ])]
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

    const result = [];

    slotTimes.forEach(t => {
      const { h, m, str24 } = parseTime(t);

      if (isTimeWithinDoctorShift(str24, doctorShifts)) {
        let isExpired = false;
        if (isToday) {
          if (h < currentHour || (h === currentHour && m <= currentMinute)) {
            isExpired = true;
          }
        }

        const isBooked = bookedTimes.includes(t);

        let status = 'Available';
        if (isExpired) status = 'Passed';
        else if (isBooked) status = 'Booked';

        // ISSUE 3 FIX: Identify if this is the original appointment time being rescheduled
        let isCurrent = false;
        if (isBooked && selectedTime === t) {
          isCurrent = true;
        }

        result.push({ time: t, status, isCurrent });
      }
    });

    return result;
  // Note: added selectedTime to dependency array so it re-evaluates 'isCurrent' when user clicks
  }, [appointments, clinicSchedule, currentHour, currentMinute, date, doctor, isToday, selectedTime]); 

  if (processedSlots.length === 0) {
    return (
      <div className="p-4 text-center border border-amber-100 rounded-lg bg-amber-50">
        <p className="text-[11px] text-amber-700 font-bold uppercase">No slots available for this date</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/50 scrollbar-hide">
      {processedSlots.map(slot => {
        const isSelected = selectedTime === slot.time;
        
        // ISSUE 1 FIX: Properly disable 'Passed' slots, and Booked slots (unless it's the Current one)
        const isDisabled = slot.status === 'Passed' || (slot.status === 'Booked' && !slot.isCurrent);
        
        let colorClass = '';
        let label = slot.status;

        // ISSUE 3 FIX: Show "Current" for pre-selected reschedule slot
        if (slot.isCurrent) {
            colorClass = 'bg-teal-600 border-teal-600 text-white shadow-md ring-2 ring-teal-200';
            label = 'Current';
        } else if (isSelected) {
            colorClass = 'bg-teal-600 border-teal-600 text-white shadow-md ring-2 ring-teal-200';
            label = 'Selected';
        } else if (slot.status === 'Available') {
            colorClass = 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 active:scale-95 cursor-pointer';
        } else if (slot.status === 'Booked') {
            colorClass = 'bg-blue-50 border-blue-200 text-blue-700 opacity-80 cursor-not-allowed';
        } else if (slot.status === 'Passed') {
            // ISSUE 2 FIX: Darker Grey for Passed/Expired slots
            colorClass = 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed shadow-inner';
        }

        return (
          <button
            key={slot.time}
            disabled={isDisabled}
            onClick={() => onSelect(slot.time)}
            className={`flex flex-col items-center justify-center p-2 rounded-lg text-center transition-all border ${colorClass}`}
          >
            <span className="text-[11px] font-bold">{slot.time}</span>
            <span className="text-[9px] mt-0.5">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TimeSlotPicker;
