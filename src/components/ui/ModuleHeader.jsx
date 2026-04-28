import React, { useState, useRef, useEffect } from 'react';
import { 
  Filter, Search, SlidersHorizontal, Bell, X, CheckCircle, AlertCircle, Clock, 
  User, LogOut, ChevronDown, Trash2, KeyRound 
} from 'lucide-react';
import MyAccountModal from '../profile/MyAccountModal';
import ChangePasswordModal from '../profile/ChangePasswordModal'; 

const ModuleHeader = ({ 
  title, 
  shortTitle, 
  showSearch = true, 
  searchVal, 
  onSearch, 
  onFilterClick, 
  hasFilter,
  notifications = [],
  onLogout,
  onClearAll, 
  onDismiss  
}) => {
  const [showNotif, setShowNotif] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false); 
  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (err) {
      return {};
    }
  })();
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const displayName = savedUser.name || localStorage.getItem('userName') || 'User';
  const displayEmail = savedUser.email || localStorage.getItem('userEmail') || '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'U';

  // Count unread (assuming all in list are 'new' until cleared, or logic can be added later)
  const unreadCount = safeNotifications.length;

  const notifRef = useRef(null);
  const profileRef = useRef(null);

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

  // REMOVED 'w-80' FROM HERE so we can apply custom widths to different dropdowns
  const POPUP_CLASSES = "fixed top-[64px] right-2 max-w-[calc(100vw-16px)] bg-white rounded-xl shadow-2xl border border-slate-200 ring-1 ring-black/5 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right";

  return (
    <>
      <MyAccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
      />
      
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
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
              {searchVal && (
                <button 
                  onClick={() => onSearch('')} 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button 
              onClick={onFilterClick}
              className={`p-1.5 rounded-lg border transition-colors ${hasFilter ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-500'}`}
            >
              <SlidersHorizontal size={16} />
              {hasFilter && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
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
                className={`relative transition-colors flex items-center justify-center w-8 h-8 rounded-full outline-none ${showNotif ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {showNotif && (
                <div className={`${POPUP_CLASSES} w-80`}> {/* <-- explicitly w-80 here */}
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Notifications</h3>
                        <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 rounded-full">{unreadCount}</span>
                      </div>
                      
                      {/* CLEAR ALL BUTTON */}
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button onClick={() => onClearAll?.()} className="text-[10px] font-bold text-teal-600 hover:text-teal-700 hover:underline">
                                Clear All
                            </button>
                        )}
                        <button onClick={() => setShowNotif(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                      </div>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                      {safeNotifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-[12px] italic">No new notifications</div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {safeNotifications.map((notif) => (
                            <div key={notif.id} className="p-3 hover:bg-slate-50 transition-colors flex gap-3 items-start group relative">
                               <div className={`mt-0.5 flex-shrink-0 ${notif.type === 'success' ? 'text-teal-500' : 'text-red-500'}`}>
                                 {notif.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                               </div>
                               <div className="flex-1 min-w-0 pr-4"> {/* Padding Right for X button */}
                                 <p className="text-[12px] text-slate-700 font-medium leading-tight">{notif.message}</p>
                                 <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                                   <Clock size={10} /> <span>{notif.timestamp}</span>
                                 </div>
                               </div>
                               
                               {/* INDIVIDUAL DISMISS BUTTON */}
                               <button 
                                 onClick={(e) => { e.stopPropagation(); onDismiss?.(notif.id); }}
                                 className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                 <X size={12} />
                               </button>
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
                   {initials}
                 </div>
                 <ChevronDown size={12} className="text-slate-400 hidden md:block" />
              </button>

              {isProfileOpen && (
                <div className={`${POPUP_CLASSES} w-50`}> {/* <-- explicitly w-50 here for tight fit */}
                    <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/30">
                      <p className="text-[13px] font-bold text-slate-800">{displayName}</p>
                      {displayEmail && <p className="text-[10px] text-slate-400 truncate">{displayEmail}</p>}
                    </div>
                    
                    <div className="p-1">
                      <button 
                        onClick={() => { setIsAccountModalOpen(true); setIsProfileOpen(false); }}
                        className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-700 rounded-lg flex items-center gap-3 transition-colors"
                      >
                        <User size={15} /> My Account
                      </button>

                      <button 
                        onClick={() => { setIsPasswordModalOpen(true); setIsProfileOpen(false); }}
                        className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-700 rounded-lg flex items-center gap-3 transition-colors mt-1"
                      >
                        <KeyRound size={15} /> Change Password
                      </button>
                      
                      <button 
                        onClick={onLogout}
                        className="w-full text-left px-3 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors mt-1 border-t border-slate-50"
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
