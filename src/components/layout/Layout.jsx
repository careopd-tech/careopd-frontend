import React from 'react';
import { Calendar, Stethoscope, Users, Settings, Activity } from 'lucide-react';
import { getAvailableTabs } from '../../utils/permissions';

const Layout = ({ activeTab, setActiveTab, userRole, clinicType, hasLinkedDoctor, permissions, children }) => {
  // DYNAMIC NAVIGATION BASED ON ROLE
  const getNavItems = () => {
    const availableTabs = getAvailableTabs({ userRole, clinicType, hasLinkedDoctor, permissions });
    const navConfig = {
      appointments: userRole === 'doctor'
        ? { id: 'appointments', label: 'Queue & Schedule', mobileLabel: 'Queue', icon: Activity }
        : { id: 'appointments', label: 'Appointments', mobileLabel: 'Appts', icon: Calendar },
      doctors: { id: 'doctors', label: 'Doctors', mobileLabel: 'Doctors', icon: Stethoscope },
      patients: { id: 'patients', label: userRole === 'doctor' ? 'My Patients' : 'Patients', mobileLabel: 'Patients', icon: Users },
      settings: { id: 'settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings }
    };

    return availableTabs.map(tabId => navConfig[tabId]).filter(Boolean);
  };

  const currentNavItems = getNavItems();

  return (
    <div className="app-viewport bg-slate-50 font-sans text-slate-900 flex overflow-hidden overscroll-none">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 app-viewport sticky top-0">
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
           <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-[15px]">C</div>
           <span className="font-bold text-[19px] tracking-tight text-slate-800">CareOPD</span>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
           {currentNavItems.map(item => (
             <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)} 
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-[15px] transition-all ${activeTab === item.id ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <item.icon size={18} /> {item.label}
             </button>
           ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col app-viewport overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
           {children}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="mobile-bottom-nav flex-none md:hidden bg-white border-t border-slate-200 flex justify-around px-1.5 pt-1.5 z-30 shadow-lg">
           {currentNavItems.map(item => (
             <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)} 
                className={`min-w-0 flex-1 flex flex-col items-center justify-center p-1.5 rounded-xl ${activeTab === item.id ? 'text-teal-600' : 'text-slate-400'}`}
             >
               <item.icon className="w-5 h-5" />
               <span className="text-[10px] font-bold mt-1">{item.mobileLabel || item.label}</span>
             </button>
           ))}
        </nav>
      </main>
    </div>
  );
};

export default Layout;
