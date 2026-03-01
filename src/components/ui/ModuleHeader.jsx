import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, Bell, X, CheckCircle, AlertCircle, Clock, 
  User, LogOut, ChevronDown 
} from 'lucide-react';
import MyAccountModal from '../profile/MyAccountModal';

const ModuleHeader = ({ 
  title, 
  shortTitle, 
  showSearch = true, 
  searchVal, 
  onSearch, 
  onFilterClick, 
  hasFilter,
  notifications = [] 
}) => {
  const [showNotif, setShowNotif] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const unreadCount = notifications.length;

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotif && notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
      if (isProfileOpen && profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotif, isProfileOpen]);

  const POPUP_CLASSES = "fixed top-[64px] right-2 w-80 max-w-[calc(100vw-16px)] bg-white rounded-xl shadow-2xl border border-slate-200 ring-1 ring-black/5 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right";

  return (
    <>
      <MyAccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
      />

      <header className="flex-none h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 flex items-center justify-between px-4 gap-2 sticky top-0">
        
        {/* TITLE */}
        <div className="flex items-center flex-shrink-0">
           <h1 className="text-[17px] font-bold text-slate-800 capitalize tracking-wide hidden md:block">{title}</h1>
           <h1 className="text-[17px] font-bold text-slate-800 capitalize tracking-wide md:hidden">{shortTitle || title}</h1>
        </div>
        
        {/* SEARCH */}
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

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-1.5">
           
           {/* --- A. NOTIFICATIONS --- */}
           <div className="relative" ref={notifRef}>
              <button 
                onClick={() => { 
                  setShowNotif(!showNotif); 
                  setIsProfileOpen(false); 
                }} 
                // ADDED: flex items-center justify-center w-8 h-8 rounded-full for perfect centering
                className={`relative transition-colors flex items-center justify-center w-8 h-8 rounded-full outline-none ${showNotif ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {showNotif && (
                <div className={POPUP_CLASSES}>
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
              )}
           </div>

           {/* --- B. PROFILE --- */}
           <div className="relative" ref={profileRef}>
              <button 
                onClick={() => { 
                  setIsProfileOpen(!isProfileOpen); 
                  setShowNotif(false); 
                }}
                className="flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors outline-none"
              >
                 <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-bold border border-teal-200">
                   AD
                 </div>
                 <ChevronDown size={12} className="text-slate-400 hidden md:block" />
              </button>

              {isProfileOpen && (
                <div className={POPUP_CLASSES}>
                    <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/30">
                      <p className="text-[13px] font-bold text-slate-800">Admin User</p>
                      <p className="text-[10px] text-slate-400 truncate">admin@careopd.com</p>
                    </div>
                    
                    <div className="p-1">
                      <button 
                        onClick={() => { setIsAccountModalOpen(true); setIsProfileOpen(false); }}
                        className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-700 rounded-lg flex items-center gap-3 transition-colors"
                      >
                        <User size={15} /> My Account
                      </button>
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors mt-1"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                </div>
              )}
           </div>

        </div>
      </header>
    </>
  );
};

export default ModuleHeader;