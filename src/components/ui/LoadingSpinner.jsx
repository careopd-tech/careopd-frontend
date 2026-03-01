import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ fullPage = false, size = 24, label = "Loading..." }) => {
  const spinnerContent = (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Lucide Loader2 with animate-spin (Tailwind built-in) */}
      <Loader2 
        size={size} 
        className="text-teal-600 animate-spin" 
      />
      {label && (
        <span className="text-[13px] font-bold text-slate-500 animate-pulse uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  );

if (fullPage) {
  return (
    // CHANGED: used 'fixed inset-0 z-50' to force full screen overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm transition-all">
      {spinnerContent}
    </div>
  );
}

  return spinnerContent;
};

export default LoadingSpinner;