import React from 'react';
import { Clock, CheckCircle, ArrowRight } from 'lucide-react';

const QueueCard = ({ appt, isActive, onClick }) => {
  const patient = appt.patientId || {};
  const isCompleted = appt.status === 'Completed' || appt.status === 'Done';
  const isCancelled = appt.status === 'Cancelled' || appt.status === 'No-Show';

  // Doctors don't need clutter. Hide cancelled/no-shows from their active view.
  if (isCancelled) return null; 

  return (
    <button 
      onClick={() => onClick(appt)}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group relative overflow-hidden flex-shrink-0 ${
        isActive 
          ? 'bg-teal-50 border-teal-200 shadow-sm ring-1 ring-teal-500/10' 
          : isCompleted
            ? 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'
            : 'bg-white border-slate-200 hover:border-teal-100 hover:shadow-sm'
      }`}
    >
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-l-xl"></div>}
      
      <div className="flex justify-between items-start mb-1.5 pl-1">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className={isActive ? 'text-teal-600' : 'text-slate-400'} />
          <span className={`text-[11px] font-bold ${isActive ? 'text-teal-700' : 'text-slate-600'}`}>
            {appt.time}
          </span>
        </div>
        
        {isCompleted ? (
           <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
             <CheckCircle size={10} /> Done
           </span>
        ) : (
           <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isActive ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
             {isActive ? 'In Consult' : 'Waiting'}
           </span>
        )}
      </div>
      
      <div className="pl-1 pr-6">
        <h4 className="font-bold text-[13px] text-slate-800 truncate">{patient.name || 'Unknown Patient'}</h4>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {patient.gender || 'U'}, {patient.age ? `${patient.age} Yrs` : 'Age Unknown'}
        </p>
      </div>

      {!isActive && !isCompleted && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-teal-400 transition-colors">
           <ArrowRight size={16} />
        </div>
      )}
    </button>
  );
};

export default QueueCard;