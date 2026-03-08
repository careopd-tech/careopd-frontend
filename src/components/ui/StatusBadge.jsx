import React from 'react';

const StatusBadge = ({ status }) => {
  const styles = {
    'Scheduled': 'text-amber-600', // Renamed from Pending
    'Completed': 'text-green-600',
    'Cancelled': 'text-red-600',
    'On Leave': 'text-amber-600',
    'Inactive': 'text-slate-500',
  };
  
  const dotStyles = {
    'Scheduled': 'bg-amber-500', // Renamed from Pending
    'Completed': 'bg-green-500',
    'Cancelled': 'bg-red-500',
    'On Leave': 'bg-amber-500',
    'Inactive': 'bg-slate-400',
  };

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${styles[status] || 'text-slate-600'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotStyles[status] || 'bg-slate-400'}`}></div>
      {status}
    </div>
  );
};

export default StatusBadge;