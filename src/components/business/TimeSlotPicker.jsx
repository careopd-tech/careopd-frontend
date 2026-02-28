import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { TIME_SLOTS } from '../../data/constants';

const TimeSlotPicker = ({ selectedTime, onSelect, doctor, date, appointments }) => {
  if (!doctor) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50">
        <Clock className="mx-auto text-slate-300 mb-2" size={24} />
        <p className="text-[12px] text-slate-400 font-medium">Select a doctor to view working hours</p>
      </div>
    );
  }

  const bookedSlots = useMemo(() => {
    if (!date) return [];
    return appointments
      .filter(a => a.doctorId === doctor.id && a.date === date && a.status !== 'Cancelled')
      .map(a => a.time);
  }, [doctor.id, date, appointments]);

  const filteredSlots = useMemo(() => {
    return TIME_SLOTS.filter(time => {
      const isMorning = time >= (doctor.morningStart || '09:00') && time < (doctor.morningEnd || '13:00');
      const isEvening = time >= (doctor.eveningStart || '17:00') && time < (doctor.eveningEnd || '21:00');
      return isMorning || isEvening;
    });
  }, [doctor]);

  if (filteredSlots.length === 0) {
    return (
      <div className="p-4 text-center border border-amber-100 rounded-lg bg-amber-50">
        <p className="text-[11px] text-amber-700 font-bold uppercase">No shifts configured for this doctor</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/50 scrollbar-hide">
      {filteredSlots.map(t => {
        const isBooked = bookedSlots.includes(t);
        const isSelected = selectedTime === t;
        
        return (
          <button
            key={t}
            disabled={isBooked}
            onClick={() => onSelect(t)}
            className={`py-2 rounded-md text-[11px] font-bold border transition-all ${
              isSelected 
                ? 'bg-teal-600 border-teal-600 text-white shadow-sm ring-2 ring-teal-600/20' 
                : isBooked 
                  ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed line-through' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600 active:scale-95'
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
};

export default TimeSlotPicker;