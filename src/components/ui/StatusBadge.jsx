import React from 'react';

const StatusBadge = ({ status }) => {
  const styles = {
    'Confirmed': 'text-green-600',
    'Completed': 'text-green-600',
    'Pending': 'text-amber-600',
    'Cancelled': 'text-red-600',
    'Available': 'text-green-600',
    'On Leave': 'text-amber-600',
    'Inactive': 'text-slate-500',
  };
  const dotStyles = {
    'Confirmed': 'bg-green-500',
    'Completed': 'bg-green-500',
    'Pending': 'bg-amber-500',
    'Cancelled': 'bg-red-500',
    'Available': 'bg-green-500',
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