import React from 'react';
import { X } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  bodyClassName = 'p-4 overflow-y-auto flex-1 overscroll-contain',
  panelClassName = 'careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn'
}) => {
  if (!isOpen) return null;
  
  // 1. Added overscroll-none to the background overlay to trap touches
  // 2. Added overscroll-contain to the inner scrolling content area
  return (
    <div
      className="careopd-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm animate-fadeIn overscroll-none"
      role="dialog"
      aria-modal="true"
      data-careopd-modal
    >
      <div className={panelClassName}>
        <div className="px-4 py-3 md:landscape:py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-[15px]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        
        <div className={bodyClassName}>
          {children}
        </div>
        
        {footer && (
          <div className="px-4 py-3 md:landscape:py-2 bg-slate-50 border-t border-slate-100 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
