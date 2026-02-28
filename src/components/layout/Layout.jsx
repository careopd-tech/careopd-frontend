import React from 'react';
import { Calendar, Stethoscope, Users, Settings } from 'lucide-react';

const navItems = [
  { id: 'appointments', label: 'Appointments', mobileLabel: 'Appts', icon: Calendar },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const Layout = ({ activeTab, setActiveTab, children }) => {
  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
           <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-[15px]">C</div>
           <span className="font-bold text-[19px] tracking-tight text-slate-800">CareOPD</span>
        </div>
        <nav className="flex-1 p-3 space-y-1.5">
           {navItems.map(item => (
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
           {children}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="flex-none md:hidden bg-white border-t border-slate-200 flex justify-around p-1.5 pb-safe z-30 shadow-lg">
           {navItems.map(item => (
             <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)} 
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl ${activeTab === item.id ? 'text-teal-600' : 'text-slate-400'}`}
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