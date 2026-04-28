import React, { useState, useEffect } from 'react';
import { LogOut, Activity, Users, Clock, Loader2, FileText, ChevronLeft, CheckCircle } from 'lucide-react';
import { useGlobalDate } from '../../context/DateContext';
import QueueCard from '../../components/doctor/QueueCard';
import API_BASE_URL from '../../config';
import ConsultationPad from '../../components/doctor/ConsultationPad';

const DoctorDashboard = ({ data, onLogout }) => {
  const dateContext = useGlobalDate();
  const safeCurrentDate = dateContext?.currentDate || new Date().toISOString().split('T')[0];
  
  const clinicId = localStorage.getItem('clinicId');
  const doctorId = localStorage.getItem('doctorId') || 'test_doctor_id'; 
  const doctorName = localStorage.getItem('doctorName') || 'Doctor';

  // --- STATE ---
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAppt, setActiveAppt] = useState(null);

  
// --- DATA FETCHING ---
  const fetchQueue = async () => {
    if (!clinicId || !doctorId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=doctor_queue&doctorId=${doctorId}&date=${safeCurrentDate}`);
      if (res.ok) {
        const fetchedQueue = await res.json();
        
        // --- BULLETPROOF FALLBACK ---
        // If Mongoose populate fails because patientId is a String, we manually cross-reference 
        // the patient details from the global data.patients array loaded by App.jsx!
        const enrichedQueue = fetchedQueue.map(appt => {
            if (typeof appt.patientId === 'string' || !appt.patientId?.name) {
                const foundPatient = data?.patients?.find(p => String(p._id) === String(appt.patientId));
                return { ...appt, patientId: foundPatient || { name: 'Unknown Patient', gender: 'U', age: '' } };
            }
            return appt;
        });

        setQueue(enrichedQueue);
        
        // Auto-update active appointment data if it gets updated in the background
        if (activeAppt) {
            const updatedAppt = enrichedQueue.find(a => a._id === activeAppt._id);
            if (updatedAppt) setActiveAppt(updatedAppt);
        }
      }
    } catch (err) {
      console.error("Failed to fetch queue", err);
    } finally {
      setIsLoading(false);
    }
  };

const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCompleteConsultation = async (apptId, prescriptionData, finalStatus) => {
    setIsSubmitting(true);
    try {
      const payload = {
        clinicId: clinicId,
        appointmentId: apptId,
        patientId: activeAppt.patientId._id, // Extract the exact patient ID
        doctorId: doctorId,
        status: finalStatus,
        prescriptionData: prescriptionData   // The data from ConsultationPad
      };
      
      const res = await fetch(`${API_BASE_URL}/api/prescriptions/complete-consultation`, {
        method: 'POST', // Changed to POST to our new route
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setActiveAppt(null); // Close the EMR pane
        fetchQueue();        // Refresh the queue (patient will disappear from Waiting)
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Error saving consultation", err);
    } finally {
      setIsSubmitting(false);
    }
  };


  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000); // 30s background sync
    return () => clearInterval(interval);
  }, [safeCurrentDate]);

  const waitingCount = queue.filter(a => a.status === 'Scheduled' || a.status === 'Waiting').length;

  return (
    <div className="app-viewport flex flex-col bg-slate-100 overflow-hidden">
      
      {/* --- HEADER --- */}
      <header className="h-[60px] bg-white border-b border-slate-200 px-3 md:px-4 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white shadow-inner">
            <Activity size={16} />
          </div>
          <div>
            <h1 className="text-[13px] md:text-[14px] font-bold text-slate-800 leading-tight">CareOPD Clinical</h1>
            <p className="text-[9px] md:text-[10px] font-medium text-slate-500 uppercase tracking-wide">Dr. {doctorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden md:block">
            <div className="text-[12px] font-bold text-teal-700">{new Date(safeCurrentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
            <div className="text-[10px] text-slate-400">Live Workspace</div>
          </div>
          <div className="hidden md:block h-8 w-px bg-slate-200 mx-1"></div>
          <button onClick={onLogout} className="flex items-center gap-1.5 p-2 text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={16} className="md:w-3.5 md:h-3.5" /> <span className="hidden md:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* --- MAIN WORKSPACE --- */}
      <div className="flex-1 flex flex-col landscape:flex-row md:flex-row gap-2 p-2 min-h-0 overflow-hidden">
        
        {/* LEFT PANE: QUEUE */}
        {/* On Portrait Mobile: Hidden if there is an active appointment. Full width otherwise. */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex-col overflow-hidden w-full landscape:w-[35%] landscape:min-w-[280px] landscape:max-w-[350px] md:w-[30%] md:min-w-[300px] md:max-w-[380px] ${activeAppt ? 'hidden landscape:flex md:flex' : 'flex'}`}>
          
          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 flex-shrink-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users size={14} className="text-teal-600"/> Today's Queue
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${waitingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {waitingCount} Waiting
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-hide bg-slate-50/30">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin text-teal-500" />
                <span className="text-[11px]">Syncing queue...</span>
              </div>
            ) : queue.length > 0 ? (
              queue.map(appt => (
                <QueueCard 
                  key={appt._id} 
                  appt={appt} 
                  isActive={activeAppt?._id === appt._id} 
                  onClick={(selectedAppt) => setActiveAppt(selectedAppt)} 
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center px-4">
                <CheckCircle size={32} className="mb-2 opacity-20 text-green-500" />
                <p className="text-[12px] font-medium text-slate-600">Queue is clear</p>
                <p className="text-[10px] mt-1">No appointments scheduled for today.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE CONSULTATION */}
        
        {/* On Portrait Mobile: Hidden if no active appointment. Full width otherwise. */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex-col overflow-hidden flex-1 relative ${!activeAppt ? 'hidden landscape:flex md:flex' : 'flex'}`}>
           {activeAppt ? (
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Active Patient Header */}
                <div className="p-3 md:p-4 border-b border-slate-100 bg-teal-50/30 flex items-center justify-between flex-shrink-0">
                   <div className="flex items-center gap-3">
                      {/* Mobile Back Button - Hidden on Desktop/Landscape */}
                      <button 
                         onClick={() => setActiveAppt(null)}
                         className="p-1.5 -ml-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-500 md:hidden landscape:hidden"
                      >
                         <ChevronLeft size={18} />
                      </button>
                      
                      <div>
                        <h2 className="text-[15px] md:text-lg font-bold text-slate-800 leading-tight truncate max-w-[180px] md:max-w-none">
                            {activeAppt.patientId?.name || 'Unknown Patient'}
                        </h2>
                        <p className="text-[11px] md:text-[12px] text-slate-500 mt-0.5 font-medium">
                            {activeAppt.patientId?.gender || 'U'} • {activeAppt.patientId?.age ? `${activeAppt.patientId.age} Yrs` : 'Age Unknown'}
                        </p>
                      </div>
                   </div>

                   <div className="text-right">
                      <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Time</div>
                      <div className="text-[13px] md:text-[14px] font-bold text-teal-700">{activeAppt.time}</div>
                   </div>
                </div>

                {/* Main EMR Canvas - To be built next */}
                <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">
    <ConsultationPad 
       activeAppt={activeAppt} 
       onComplete={handleCompleteConsultation} 
       isSubmitting={isSubmitting} 
    />
</div>

              </div>
           ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                 <Activity size={48} className="mb-3 opacity-20 text-teal-600" />
                 <p className="text-[14px] font-medium text-slate-600">No Patient Selected</p>
                 <p className="text-[11px] mt-1 max-w-[200px]">Select a patient from the queue to begin the consultation.</p>
              </div>
           )}
        </div>

      </div>
    </div>
  );
};

export default DoctorDashboard;
