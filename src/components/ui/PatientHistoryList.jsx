import React, { useState } from 'react';
import { History, Loader2, Activity, FileText, Pill, FlaskConical, RotateCw } from 'lucide-react';
import { getLocalDateString } from '../../utils/dateUtils';
import { getAppointmentUiStatus, hasClinicalRecordStatus } from '../../utils/appointmentStatus';

export const getUiStatus = (appt) => getAppointmentUiStatus(appt, getLocalDateString());

export const getStatusStyling = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'DONE') return { badge: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500 ring-green-100' };
  if (s === 'TEST RECOMMENDED' || s === 'TESTS RECOMMENDED') return { badge: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500 ring-emerald-100' };
  if (s === 'AWAITING REPORTS') return { badge: 'text-cyan-700 bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500 ring-cyan-100' };
  if (s === 'CANCELLED') return { badge: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500 ring-red-100' };
  if (s === 'WALKED OUT' || s === 'LEFT EARLY') return { badge: 'text-slate-700 bg-slate-100 border-slate-200', dot: 'bg-slate-500 ring-slate-100' };
  if (s === 'DRAFT') return { badge: 'text-violet-700 bg-violet-50 border-violet-200', dot: 'bg-violet-500 ring-violet-100' };
  if (s === 'NO SHOW' || s === 'NO-SHOW') return { badge: 'text-slate-600 bg-slate-100 border-slate-200', dot: 'bg-slate-400 ring-slate-100' };
  if (s === 'CHECKED IN') return { badge: 'text-teal-700 bg-teal-50 border-teal-200', dot: 'bg-teal-500 ring-teal-100' };
  return { badge: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500 ring-blue-100' };
};

export const hasClinicalRecord = (status) => hasClinicalRecordStatus(status);

export const filterValidHistory = (historyData = [], currentApptId = null) => {
  const todayStr = getLocalDateString();
  return historyData.filter((visit) => {
    if (currentApptId && String(visit._id) === String(currentApptId)) return false;
    if (visit.date < todayStr) return true;
    if (visit.date === todayStr && ['Completed', 'Done', 'Tests Recommended', 'Left Early'].includes(visit.status)) return true;
    return false;
  });
};

const getFormattedUnit = (med = {}) => {
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

const getClinicalTimeline = (visit = {}) => {
  if (Array.isArray(visit.consultationTimeline) && visit.consultationTimeline.length > 0) {
    return visit.consultationTimeline;
  }

  return [{
    _id: visit.latestConsultationId || visit._id,
    entryType: 'Initial Consultation',
    resultStatus: visit.status,
    consultationStartedAt: visit.consultationStartedAt || null,
    consultationCompletedAt: visit.latestConsultationAt || visit.consultationCompletedAt || null,
    doctor: visit.doctorId,
    vitals: visit.vitals,
    complaints: visit.complaints,
    diagnosis: visit.diagnosis,
    advice: visit.advice,
    medicines: visit.medicines,
    labTests: visit.labTests
  }];
};

const formatTimelineTimestamp = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const renderClinicalEntry = (entry, index, totalEntries, onRefillRx) => (
  <div key={entry._id || index} className={`rounded-lg border border-slate-100 bg-white shadow-sm ${index < totalEntries - 1 ? 'mb-3' : ''}`}>
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">
          {entry.entryType || (index === 0 ? 'Initial Consultation' : 'Clinical Update')}
        </div>
        {entry.resultStatus ? (
          <div className="mt-1 text-[12px] text-slate-500">{entry.resultStatus}</div>
        ) : null}
      </div>
      {entry.consultationCompletedAt ? (
        <div className="text-right text-[12px] text-slate-500">{formatTimelineTimestamp(entry.consultationCompletedAt)}</div>
      ) : null}
    </div>

    <div className="p-3 space-y-4">
      {(entry.vitals?.bp || entry.vitals?.temp || entry.vitals?.weight) && (
        <div>
          <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Activity size={12} /> Vitals</h4>
          <div className="flex gap-4 bg-white p-2 rounded-lg border border-slate-100">
            {entry.vitals.bp && <div><span className="text-[12px] text-slate-400 uppercase font-bold block">BP</span><span className="text-[12px] font-bold text-slate-800">{entry.vitals.bp}</span></div>}
            {entry.vitals.temp && <div><span className="text-[12px] text-slate-400 uppercase font-bold block">Temp</span><span className="text-[12px] font-bold text-slate-800">{entry.vitals.temp}F</span></div>}
            {entry.vitals.weight && <div><span className="text-[12px] text-slate-400 uppercase font-bold block">Weight</span><span className="text-[12px] font-bold text-slate-800">{entry.vitals.weight} kg</span></div>}
          </div>
        </div>
      )}

      {(entry.complaints || entry.diagnosis) && (
        <div>
          <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileText size={12} /> Notes</h4>
          <div className="bg-white p-2 rounded-lg border border-slate-100 space-y-2">
            {entry.complaints && <div><span className="text-[12px] text-slate-400 uppercase font-bold block">Complaints</span><span className="text-[12px] font-medium text-slate-800">{entry.complaints}</span></div>}
            {entry.diagnosis && <div><span className="text-[12px] text-slate-400 uppercase font-bold block">Diagnosis</span><span className="text-[12px] font-bold text-teal-800">{entry.diagnosis}</span></div>}
          </div>
        </div>
      )}

      {entry.medicines && entry.medicines.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center"><span className="flex items-center gap-1.5"><Pill size={12} /> Rx</span><span className="text-[12px] text-teal-600 bg-teal-50 px-1.5 rounded font-bold">{entry.medicines.length}</span></h4>
          <div className="border border-slate-100 rounded-lg overflow-hidden bg-white">
            {entry.medicines.map((med, medIndex) => (
              <div key={`${entry._id || index}-med-${medIndex}`} className="p-2 border-b border-slate-50 last:border-0">
                <div className="text-[12px] font-bold text-slate-800">{medIndex + 1}. {med.name}</div>
                <div className="text-[12px] text-teal-700 font-medium flex gap-1 items-center mt-0.5">
                  <span>{med.route}</span><span>&bull;</span><span>{getFormattedUnit(med)}</span><span>&bull;</span><span>{med.frequency}</span><span>&bull;</span><span className="text-slate-500">{med.timing}</span>
                </div>
                <div className="text-[12px] text-slate-500 mt-1 flex gap-1 items-center">
                  <span className="font-bold text-slate-600 bg-slate-100 px-1 rounded">{med.duration}</span>
                  {med.instructions && <span className="italic">| {med.instructions}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.labTests && entry.labTests.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FlaskConical size={12} /> Labs</h4>
          <div className="flex flex-wrap gap-1 bg-white p-2 rounded-lg border border-slate-100">
            {entry.labTests.map((test, idx) => (
              <span key={`${entry._id || index}-lab-${idx}`} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[12px] font-medium border border-blue-100">{test.name}</span>
            ))}
          </div>
        </div>
      )}

      {onRefillRx && entry.medicines && entry.medicines.length > 0 && index === 0 && (
        <button type="button" onClick={() => onRefillRx(entry.medicines)} className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[12px] rounded-lg transition-colors flex justify-center items-center gap-1.5 mt-2 border border-blue-200">
          <RotateCw size={12} /> Repeat Medicines from Latest Record
        </button>
      )}
    </div>
  </div>
);

const PatientHistoryList = ({
  historyData = [],
  isLoading = false,
  layout = 'horizontal',
  embeddedMarker = false,
  onVisitClick,
  onFetchDetails,
  onRefillRx
}) => {
  const loggedInDoctorId = localStorage.getItem('doctorId');
  const loggedInRole = localStorage.getItem('userRole') || 'admin';
  const [expandedId, setExpandedId] = useState(null);
  const [fetchingId, setFetchingId] = useState(null);

  if (isLoading) {
    if (layout === 'horizontal') return <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-[12px]"><Loader2 size={14} className="animate-spin" /> Fetching records...</div>;
    return <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2"><Loader2 size={24} className="animate-spin text-blue-600" /><span className="text-[12px] font-medium">Loading timeline...</span></div>;
  }

  if (!historyData || historyData.length === 0) {
    if (layout === 'horizontal') return <div className="text-[12px] text-slate-400 italic py-2 text-center">No previous visits recorded for this patient.</div>;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <History size={32} className="mb-2 opacity-20" />
        <span className="text-[13px] font-medium text-slate-500">No past records found.</span>
      </div>
    );
  }

  if (layout === 'horizontal') {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 pt-1">
        {historyData.map((visit, idx) => {
          const isLatest = idx === 0;
          const uiStatus = getUiStatus(visit);
          const styling = getStatusStyling(uiStatus);
          const canOpenVisit = hasClinicalRecord(uiStatus);
          const followUpNoteCount = Number(visit.followUpNoteCount || 0);

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
              onClick={() => hasPermission && canOpenVisit && onVisitClick && onVisitClick(visit)}
              disabled={!hasPermission || !canOpenVisit}
              className={`flex-none w-32 p-2 rounded-xl shadow-sm transition-all flex flex-col items-start justify-center gap-1 border ${isLatest ? 'border-teal-500 bg-teal-50/20' : 'border-slate-200 bg-white'} ${hasPermission && canOpenVisit ? 'hover:shadow-md hover:border-teal-400 cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
              title={!hasPermission ? 'HIPAA Restriction: You are not the attending doctor for this visit.' : (!canOpenVisit ? 'No clinical record exists for missed or cancelled visits.' : 'View details')}
            >
              <span className={`text-[12px] font-bold ${isLatest ? 'text-teal-800' : 'text-slate-700'}`}>{visit.date}</span>
              {!hideDoctorName && (
                <span className="text-[12px] text-slate-500 truncate w-full text-left">Dr. {visit.doctorId?.name?.replace(/^Dr\.\s*/i, '') || 'Unknown'}</span>
              )}
              <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase mt-0.5 border ${styling.badge}`}>{uiStatus}</span>
              {followUpNoteCount > 0 && (
                <span className="text-[12px] font-bold px-1.5 py-0.5 rounded mt-0.5 border border-teal-200 bg-teal-50 text-teal-700">
                  +{followUpNoteCount} Update{followUpNoteCount > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  const handleAccordionClick = async (visit, hasPermission) => {
    if (!hasPermission) return;

    if (expandedId === visit._id) {
      setExpandedId(null);
      return;
    }

    const hasDetails = visit.vitals || visit.complaints || visit.medicines || (Array.isArray(visit.consultationTimeline) && visit.consultationTimeline.length > 0);
    if (!hasDetails && onFetchDetails) {
      setFetchingId(visit._id);
      await onFetchDetails(visit._id);
      setFetchingId(null);
    }

    setExpandedId(visit._id);
  };

  return (
    <div className={embeddedMarker ? 'space-y-3 py-0' : 'relative before:absolute before:inset-0 before:left-[15px] md:before:left-1/2 md:before:-translate-x-1/2 before:w-0.5 before:bg-slate-200 space-y-4 py-0 pr-1'}>
      {historyData.map((visit, idx) => {
        const uiStatus = getUiStatus(visit);
        const styling = getStatusStyling(uiStatus);
        const isExpanded = expandedId === visit._id;
        const isFetching = fetchingId === visit._id;
        const clinicalTimeline = getClinicalTimeline(visit);
        const hasMultipleClinicalEntries = clinicalTimeline.length > 1;

        const visitDocId = String(visit.doctorId?._id || visit.doctorId);
        const isOwnConsultation = loggedInDoctorId ? (visitDocId === String(loggedInDoctorId)) : false;
        const hideDoctorName = isOwnConsultation && uiStatus !== 'No Show' && uiStatus !== 'No-Show';

        let hasPermission = false;
        if (loggedInRole === 'doctor') hasPermission = true;
        else if (loggedInDoctorId) hasPermission = isOwnConsultation;

        const hasValidStatus = hasClinicalRecord(uiStatus);
        const canExpand = hasPermission && hasValidStatus;

        return (
          <div key={visit._id || idx} className={embeddedMarker ? 'group' : 'relative flex flex-col md:flex-row items-start justify-between md:justify-normal md:odd:flex-row-reverse group'}>
            {!embeddedMarker && (
              <div className={`absolute top-3 left-[15px] md:left-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full border-2 border-white ring-4 shadow-sm ${styling.dot} z-10`}>
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            )}

            <div className={`${embeddedMarker ? 'w-full' : 'w-[calc(100%-2.5rem)] ml-auto md:ml-0 md:w-[calc(50%-1.5rem)]'} rounded-xl border transition-all shadow-sm overflow-hidden flex flex-col ${canExpand ? (isExpanded ? 'border-teal-300 ring-2 ring-teal-50 shadow-md bg-white' : 'border-slate-200 bg-white hover:border-slate-300') : 'border-slate-100 bg-white/60'}`}>
              <button
                type="button"
                onClick={() => handleAccordionClick(visit, hasPermission)}
                disabled={!canExpand || isFetching}
                className={`w-full p-3 text-left focus:outline-none flex flex-col ${canExpand ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                title={!hasPermission ? 'HIPAA Restriction: You are not the attending doctor.' : (!hasValidStatus ? 'No clinical notes for missed or cancelled visits.' : 'Click to view clinical notes')}
              >
                <div className={`flex items-center gap-2 w-full ${hideDoctorName && canExpand ? 'mb-2' : (!hideDoctorName ? 'mb-1' : '')}`}>
                  {embeddedMarker && (
                    <span className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full ${styling.dot}`}>
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    </span>
                  )}
                  <span className={`text-[13px] font-bold ${canExpand ? 'text-slate-800' : 'text-slate-500'}`}>
                    {visit.date} • {visit.time}
                  </span>
                  <span className={`ml-auto text-[12px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${styling.badge}`}>
                    {uiStatus}
                  </span>
                </div>

                {!hideDoctorName && (
                  <div className={`text-[12px] text-slate-500 w-full ${canExpand ? 'mb-2' : ''}`}>
                    Consultation w/ <span className={`font-bold ${canExpand ? 'text-slate-700' : 'text-slate-400'}`}>Dr. {visit.doctorId?.name?.replace(/^Dr\.\s*/i, '') || 'Unknown'}</span>
                  </div>
                )}

                {visit.followUpNoteCount > 0 && (
                  <div className="w-full mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[12px] font-bold text-teal-700">
                      {visit.followUpNoteCount} Follow-Up Note{visit.followUpNoteCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {canExpand && (
                  <div className={`w-full h-7 text-[12px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${isExpanded ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                    {isFetching ? (
                      <><Loader2 size={12} className="animate-spin" /> Loading...</>
                    ) : (
                      <>{isExpanded ? 'Hide Details' : 'View Details'}</>
                    )}
                  </div>
                )}
              </button>

              {isExpanded && !isFetching && (
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-slideDown cursor-default">
                  {hasMultipleClinicalEntries && (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Clinical Timeline</div>
                      <div className="mt-1 text-[12px] text-slate-500">
                        This visit contains the original consultation and {visit.followUpNoteCount || (clinicalTimeline.length - 1)} follow-up update{(visit.followUpNoteCount || (clinicalTimeline.length - 1)) > 1 ? 's' : ''}.
                      </div>
                    </div>
                  )}

                  {clinicalTimeline.map((entry, entryIndex) => renderClinicalEntry(entry, entryIndex, clinicalTimeline.length, onRefillRx))}
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
