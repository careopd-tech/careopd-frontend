import React, { useState } from 'react';
import { Search, SlidersHorizontal, Bell, X, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const ModuleHeader = ({ 
  title, 
  shortTitle, 
  showSearch = true, 
  searchVal, 
  onSearch, 
  onFilterClick, 
  hasFilter,
  notifications = [] // New Prop for history
}) => {
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.length;

  return (
    // Your Original Styling Preserved (h-14, backdrop-blur, etc.)
    <header className="flex-none h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 flex items-center justify-between px-4 gap-2 sticky top-0">
      
      {/* 1. TITLE SECTION */}
      <div className="flex items-center flex-shrink-0">
         <h1 className="text-[17px] font-bold text-slate-800 capitalize tracking-wide hidden md:block">{title}</h1>
         <h1 className="text-[17px] font-bold text-slate-800 capitalize tracking-wide md:hidden">{shortTitle || title}</h1>
      </div>
      
      {/* 2. SEARCH & FILTER SECTION */}
      {showSearch && (
        <div className="flex-1 max-w-md mx-auto flex items-center gap-1.5 px-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full pl-8 pr-2 py-[7px] bg-slate-50 border-none rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500 outline-none transition-all placeholder:text-slate-400"
              value={searchVal}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={onFilterClick}
            className={`p-1.5 rounded-lg border transition-colors ${hasFilter ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-500'}`}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      )}

      {/* 3. RIGHT ACTIONS (Notification & Profile) */}
      <div className="flex items-center gap-3">
         
         {/* NOTIFICATION BELL WITH DROPDOWN */}
         <div className="relative">
            <button 
              onClick={() => setShowNotif(!showNotif)} 
              className={`relative transition-colors ${showNotif ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Bell size={18} />
              {/* Dynamic Red Dot */}
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {/* THE DROPDOWN PANEL (Added logic inside your style) */}
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>
                <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Notifications</h3>
                    <button onClick={() => setShowNotif(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-[12px] italic">No new notifications</div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {notifications.map((notif) => (
                          <div key={notif.id} className="p-3 hover:bg-slate-50 transition-colors flex gap-3 items-start">
                             <div className={`mt-0.5 flex-shrink-0 ${notif.type === 'success' ? 'text-teal-500' : 'text-red-500'}`}>
                               {notif.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-[12px] text-slate-700 font-medium leading-tight">{notif.message}</p>
                               <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                                 <Clock size={10} /> <span>{notif.timestamp}</span>
                               </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
         </div>

         {/* Profile Avatar */}
         <div className="flex w-7 h-7 rounded-full bg-teal-100 text-teal-700 items-center justify-center text-[11px] font-bold border border-teal-200 cursor-pointer">AD</div>
      </div>
    </header>
  );
};

export default ModuleHeader;