import React from 'react';
import { AlertTriangle } from 'lucide-react';

const AlertMessage = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="bg-red-50 text-red-600 p-2.5 rounded-lg flex items-start gap-2 mb-3 text-[12px] font-medium border border-red-100 animate-fadeIn">
      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export default AlertMessage;