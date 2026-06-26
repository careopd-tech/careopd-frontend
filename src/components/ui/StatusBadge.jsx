import React from 'react';

const StatusBadge = ({ status }) => {
  const styles = {
    'Scheduled': 'text-amber-600', // Renamed from Pending
    'Checked In': 'text-teal-600',
    'Draft': 'text-violet-700',
    'In Consultation': 'text-blue-600',
    'Awaiting Reports': 'text-cyan-700',
    'Delayed': 'text-orange-600',
    'Walked Out': 'text-slate-600',
    'Completed': 'text-green-600',
    'Test Recommended': 'text-emerald-700',
    'Cancelled': 'text-red-600',
    'No Show': 'text-slate-600',
    'No-Show': 'text-slate-600',
    'On Leave': 'text-amber-600',
    'Inactive': 'text-slate-600',
  };
  
  const dotStyles = {
    'Scheduled': 'bg-amber-500', // Renamed from Pending
    'Checked In': 'bg-teal-500',
    'Draft': 'bg-violet-500',
    'In Consultation': 'bg-blue-500',
    'Awaiting Reports': 'bg-cyan-500',
    'Delayed': 'bg-orange-500',
    'Walked Out': 'bg-slate-500',
    'Completed': 'bg-green-500',
    'Test Recommended': 'bg-emerald-500',
    'Cancelled': 'bg-red-500',
    'No Show': 'bg-slate-400',
    'No-Show': 'bg-slate-400',
    'On Leave': 'bg-amber-500',
    'Inactive': 'bg-slate-400',
  };

  return (
    <div className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold leading-6 tracking-[0.04em] uppercase ${styles[status] || 'text-slate-600'}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotStyles[status] || 'bg-slate-400'}`}></div>
      {status}
    </div>
  );
};

export default StatusBadge;
