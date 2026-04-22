import React, { useState } from 'react';
import { History, Loader2, ChevronDown, Activity, FileText, Pill, FlaskConical, RotateCw } from 'lucide-react';

// --- SHARED LOGIC & HELPERS ---
export const getUiStatus = (appt) => {
  if (appt.status === 'Cancelled') return 'Cancelled';
  if (appt.status === 'Completed' || appt.status === 'Done') return 'Completed';
  const todayStr = new Date().toISOString().split('T')[0];
  const isPast = appt.date < todayStr;
  if (isPast && (appt.status === 'Scheduled' || appt.status === 'Pending')) return 'No Show';
  return appt.status || 'Scheduled';
};

export const getStatusStyling = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'DONE') return { badge: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500 ring-green-100' };
  if (s === 'CANCELLED') return { badge: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500 ring-red-100' };
  if (s === 'NO SHOW' || s === 'NO-SHOW') return { badge: 'text-slate-600 bg-slate-100 border-slate-200', dot: 'bg-slate-400 ring-slate-100' };
  return { badge: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500 ring-blue-100' }; // Scheduled
};

export const filterValidHistory = (historyData = [], currentApptId = null) => {
  const todayStr = new Date().toISOString().split('T')[0];
  return historyData.filter(visit => {
    if (currentApptId && String(visit._id) === String(currentApptId)) return false;
    if (visit.date < todayStr) return true;
    if (visit.date === todayStr && (visit.status === 'Completed' || visit.status === 'Done')) return true;
    return false;
  });
};

const getFormattedUnit = (med) => {
  if (med.duration === 'Custom') return med.quantity;
  let unit = '';
  const nameLower = (med.name || '').toLowerCase();
  if (nameLower.startsWith('tab') || nameLower.includes(' tab')) unit = 'Tab';
  else if (nameLower.startsWith('cap') || nameLower.includes(' cap')) unit = 'Cap';
  else if (nameLower.startsWith('syp') || nameLower.includes('syrup')) unit = 'ml';
  else if (nameLower.includes('drop')) unit = 'Drop';
  else if (nameLower.startsWith('inj') || nameLower.includes('injection')) unit = 'Amp';
  const hasLetters = /[a-zA-Z]/.test(med.quantity || '');
  return hasLetters ? med.quantity : `${med.quantity} ${unit}`.trim();
};

// --- THE COMPONENT ---
const PatientHistoryList = ({ 
    historyData = [], 
    isLoading = false, 
    layout = 'horizontal', 
    onVisitClick,        // Used for Horizontal layout (e.g. Pad Modal trigger)
    onFetchDetails,      // Used for Vertical layout Lazy Loading
    onRefillRx           // Optional callback to show "Repeat Medicine" button
}) => {
    const loggedInDoctorId = localStorage.getItem('doctorId');
    const loggedInRole = localStorage.getItem('userRole') || 'admin';

    // Vertical Layout States
    const [expandedId, setExpandedId] = useState(null);
    const [fetchingId, setFetchingId] = useState(null);

    // --- LOADING & EMPTY STATES ---
    if (isLoading) {
        if (layout === 'horizontal') return <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-[11px]"><Loader2 size={14} className="animate-spin" /> Fetching records...</div>;
        return <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2"><Loader2 size={24} className="animate-spin text-blue-600" /><span className="text-[12px] font-medium">Loading timeline...</span></div>;
    }

    if (!historyData || historyData.length === 0) {
        if (layout === 'horizontal') return <div className="text-[11px] text-slate-400 italic py-2 text-center">No previous visits recorded for this patient.</div>;
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
               <History size={32} className="mb-2 opacity-20" />
               <span className="text-[13px] font-medium text-slate-500">No valid past records found.</span>
            </div>
        );
    }

    // --- HORIZONTAL LAYOUT (For Consultation Pad Top Bar) ---
    if (layout === 'horizontal') {
        return (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 pt-1">
                {historyData.map((visit, idx) => {
                    const isLatest = idx === 0;
                    const uiStatus = getUiStatus(visit);
                    const styling = getStatusStyling(uiStatus);
                    
                    const visitDocId = String(visit.doctorId?._id || visit.doctorId);
                    let hasPermission = false;
                    if (loggedInRole === 'doctor') hasPermission = true; 
                    else if (loggedInDoctorId) hasPermission = visitDocId === String(loggedInDoctorId);
                    
                    const isOwnConsultation = loggedInDoctorId ? (visitDocId === String(loggedInDoctorId)) : false;
                    const hideDoctorName = isOwnConsultation && uiStatus !== 'No Show' && uiStatus !== 'No-Show';

                    return (
                        <button 
                            key={visit._id || idx} 
                            type="button"
                            onClick={() => hasPermission && onVisitClick && onVisitClick(visit)}
                            className={`flex-none w-28 p-2 rounded-xl shadow-sm transition-all flex flex-col items-start justify-center gap-1 border
                              ${isLatest ? 'border-teal-500 bg-teal-50/20' : 'border-slate-200 bg-white'} 
                              ${hasPermission ? 'hover:shadow-md hover:border-teal-400 cursor-pointer' : 'cursor-not-allowed opacity-75'}
                            `}
                            title={!hasPermission ? "HIPAA Restriction: You are not the attending doctor for this visit." : "View details"}
                        >
                            <span className={`text-[11px] font-bold ${isLatest ? 'text-teal-800' : 'text-slate-700'}`}>{visit.date}</span>
                            {!hideDoctorName && (
                                <span className="text-[9px] text-slate-500 truncate w-full text-left">Dr. {visit.doctorId?.name?.replace(/^Dr\.\s*/i, '') || 'Unknown'}</span>
                            )}
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase mt-0.5 border ${styling.badge}`}>{uiStatus}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    // --- VERTICAL LAYOUT ACCORDION LOGIC ---
    const handleAccordionClick = async (visit, hasPermission) => {
        if (!hasPermission) return;
        
        if (expandedId === visit._id) {
            setExpandedId(null); // Collapse if already open
            return;
        }

        // Lazy Loading architectural condition
        // If the visit lacks deep-dive details (e.g., vitals object is missing) and we have a fetch callback
        const hasDetails = visit.vitals || visit.complaints || visit.medicines; 
        if (!hasDetails && onFetchDetails) {
            setFetchingId(visit._id);
            await onFetchDetails(visit._id); // Wait for parent to update state
            setFetchingId(null);
        }
        
        setExpandedId(visit._id);
    };

    // --- VERTICAL LAYOUT (For Patients Page / History Timeline) ---
    return (
        <div className="relative before:absolute before:inset-0 before:left-[15px] md:before:left-1/2 md:before:-translate-x-1/2 before:w-0.5 before:bg-slate-200 space-y-4 py-0 pr-1">
            {historyData.map((visit, idx) => {
                const uiStatus = getUiStatus(visit);
                const styling = getStatusStyling(uiStatus);
                const isExpanded = expandedId === visit._id;
                const isFetching = fetchingId === visit._id;
                
                // 1. Check HIPAA Permission & Ownership
                const visitDocId = String(visit.doctorId?._id || visit.doctorId);
                const isOwnConsultation = loggedInDoctorId ? (visitDocId === String(loggedInDoctorId)) : false;
                const hideDoctorName = isOwnConsultation && uiStatus !== 'No Show' && uiStatus !== 'No-Show';
                
                let hasPermission = false;
                if (loggedInRole === 'doctor') hasPermission = true; 
                else if (loggedInDoctorId) hasPermission = isOwnConsultation;

                // 2. Check if Visit actually happened (No Show / Cancelled shouldn't expand)
                const hasValidStatus = uiStatus !== 'No Show' && uiStatus !== 'Cancelled';
                
                // 3. Final Actionable State
                const canExpand = hasPermission && hasValidStatus;

                return (
                    <div key={visit._id || idx} className="relative flex flex-col md:flex-row items-start justify-between md:justify-normal md:odd:flex-row-reverse group">
                        {/* Timeline Dot */}
                        <div className={`absolute top-3 left-[15px] md:left-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full border-2 border-white ring-4 shadow-sm ${styling.dot} z-10`}>
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                        
                        {/* History Card Accordion Wrapper */}
                        <div className={`w-[calc(100%-2.5rem)] ml-auto md:ml-0 md:w-[calc(50%-1.5rem)] rounded-xl border transition-all shadow-sm overflow-hidden flex flex-col
                            ${canExpand 
                                ? (isExpanded ? 'border-teal-300 ring-2 ring-teal-50 shadow-md bg-white' : 'border-slate-200 bg-white hover:border-slate-300') 
                                : 'border-slate-100 bg-white/60' // Dimmer background for No-Shows
                            }
                        `}>
                            
                            {/* Card Header (Clickable - 3 Row Layout) */}
                            <button 
                                type="button"
                                onClick={() => handleAccordionClick(visit, hasPermission)}
                                disabled={!canExpand || isFetching}
                                className={`w-full p-3 text-left focus:outline-none flex flex-col ${canExpand ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                                title={!hasPermission ? "HIPAA Restriction: You are not the attending doctor." : (!hasValidStatus ? "No clinical notes for missed or cancelled visits." : "Click to view clinical notes")}
                            >
                                {/* ROW 1: Date/Time & Status Badge */}
                                <div className={`flex items-center justify-between w-full ${hideDoctorName && canExpand ? 'mb-2' : (!hideDoctorName ? 'mb-1' : '')}`}>
                                    <span className={`text-[13px] font-bold ${canExpand ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {visit.date} • {visit.time}
                                    </span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${styling.badge}`}>
                                        {uiStatus}
                                    </span>
                                </div>
                                
                                {/* ROW 2: Context */}
                                {!hideDoctorName && (
                                    <div className={`text-[11px] text-slate-500 w-full ${canExpand ? 'mb-2' : ''}`}>
                                        Consultation w/ <span className={`font-bold ${canExpand ? 'text-slate-700' : 'text-slate-400'}`}>Dr. {visit.doctorId?.name?.replace(/^Dr\.\s*/i, '') || 'Unknown'}</span>
                                    </div>
                                )}

                                {/* ROW 3: Action Button */}
                                    {canExpand && (
                                        <div className={`w-full h-7 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors
                                            ${isExpanded ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}
                                        `}>
                                            {isFetching ? (
                                                <><Loader2 size={12} className="animate-spin" /> Loading...</>
                                            ) : (
                                                <>{isExpanded ? 'Hide Details' : 'View Details'}</>
                                            )}
                                        </div>
                                    )}
                            </button>

                            {/* Card Body (The Deep Dive Details) */}
                            {isExpanded && !isFetching && (
                                <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-slideDown cursor-default">
                                    
                                    {/* 1. Vitals */}
                                    {(visit.vitals?.bp || visit.vitals?.temp || visit.vitals?.weight) && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Activity size={12} /> Vitals</h4>
                                            <div className="flex gap-4 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                {visit.vitals.bp && <div><span className="text-[9px] text-slate-400 uppercase font-bold block">BP</span><span className="text-[11px] font-bold text-slate-800">{visit.vitals.bp}</span></div>}
                                                {visit.vitals.temp && <div><span className="text-[9px] text-slate-400 uppercase font-bold block">Temp</span><span className="text-[11px] font-bold text-slate-800">{visit.vitals.temp}°F</span></div>}
                                                {visit.vitals.weight && <div><span className="text-[9px] text-slate-400 uppercase font-bold block">Weight</span><span className="text-[11px] font-bold text-slate-800">{visit.vitals.weight} kg</span></div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. Clinical Notes */}
                                    {(visit.complaints || visit.diagnosis) && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileText size={12} /> Notes</h4>
                                            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm space-y-2">
                                                {visit.complaints && <div><span className="text-[9px] text-slate-400 uppercase font-bold block">Complaints</span><span className="text-[11px] font-medium text-slate-800">{visit.complaints}</span></div>}
                                                {visit.diagnosis && <div><span className="text-[9px] text-slate-400 uppercase font-bold block">Diagnosis</span><span className="text-[11px] font-bold text-teal-800">{visit.diagnosis}</span></div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Medicines */}
                                    {visit.medicines && visit.medicines.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center"><span className="flex items-center gap-1.5"><Pill size={12} /> Rx</span><span className="text-[9px] text-teal-600 bg-teal-50 px-1.5 rounded font-bold">{visit.medicines.length}</span></h4>
                                            <div className="border border-slate-100 rounded-lg overflow-hidden bg-white shadow-sm">
                                                {visit.medicines.map((med, index) => (
                                                    <div key={index} className="p-2 border-b border-slate-50 last:border-0">
                                                        <div className="text-[11px] font-bold text-slate-800">{index + 1}. {med.name}</div>
                                                        <div className="text-[10px] text-teal-700 font-medium flex gap-1 items-center mt-0.5">
                                                            <span>{med.route}</span>•<span>{getFormattedUnit(med)}</span>•<span>{med.frequency}</span>•<span className="text-slate-500">{med.timing}</span>
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 mt-1 flex gap-1 items-center">
                                                            <span className="font-bold text-slate-600 bg-slate-100 px-1 rounded">{med.duration}</span>
                                                            {med.instructions && <span className="italic">| {med.instructions}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Labs */}
                                    {visit.labTests && visit.labTests.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FlaskConical size={12} /> Labs</h4>
                                            <div className="flex flex-wrap gap-1 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                {visit.labTests.map((test, idx) => (
                                                    <span key={idx} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-100">{test.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Refill Button (Only shown if parent passes onRefillRx) */}
                                    {onRefillRx && visit.medicines && visit.medicines.length > 0 && (
                                        <button type="button" onClick={() => onRefillRx(visit.medicines)} className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition-colors flex justify-center items-center gap-1.5 mt-2 border border-blue-200">
                                            <RotateCw size={12} /> Repeat Medicines from this Visit
                                        </button>
                                    )}

                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PatientHistoryList;