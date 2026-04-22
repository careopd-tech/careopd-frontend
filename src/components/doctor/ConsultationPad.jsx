import React, { useState, useEffect } from 'react';
import PatientHistoryList, { filterValidHistory, getUiStatus, getStatusStyling } from '../ui/PatientHistoryList';
import { Plus, Trash2, FileText, Activity, Pill, CheckCircle, Loader2, FlaskConical, X, History, Search, ChevronRight, Check, ChevronDown, RotateCw } from 'lucide-react';
import API_BASE_URL from '../../config';

// --- CLINICAL DICTIONARIES ---
const TOP_COMPLAINTS = ['Fever', 'Cough', 'Headache', 'Stomach ache', 'Body ache', 'Vomiting', 'Loose motion', 'Weakness', 'Cold'];
const TOP_LABS = ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Urine Routine', 'HbA1c', 'Thyroid Profile', 'X-Ray Chest', 'ECG'];

const ALL_COMPLAINTS = [
  { category: 'General', items: ['Fever', 'Chills', 'Fatigue', 'Weakness', 'Weight Loss', 'Weight Gain', 'Loss of Appetite', 'Body ache'] },
  { category: 'Respiratory', items: ['Cough', 'Shortness of Breath', 'Wheezing', 'Sore Throat', 'Chest Congestion', 'Sputum Production'] },
  { category: 'Gastrointestinal', items: ['Stomach ache', 'Nausea', 'Vomiting', 'Loose motion', 'Constipation', 'Acidity / Heartburn', 'Bloating', 'Blood in Stool'] },
  { category: 'Neurological', items: ['Headache', 'Dizziness / Vertigo', 'Fainting', 'Numbness', 'Tingling', 'Tremors'] },
  { category: 'Musculoskeletal', items: ['Joint Pain', 'Back Ache', 'Neck Pain', 'Muscle Cramps', 'Swelling in Joints'] },
  { category: 'Skin', items: ['Rash', 'Itching', 'Acne', 'Skin Lesion', 'Hair Fall', 'Discoloration'] }
];

const ALL_LABS = [
  { category: 'Blood Routine', items: ['CBC', 'ESR', 'Peripheral Smear', 'Blood Grouping'] },
  { category: 'Biochemistry', items: ['LFT', 'KFT', 'Lipid Profile', 'Blood Sugar Fasting (FBS)', 'Blood Sugar PP (PPBS)', 'HbA1c', 'Serum Electrolytes', 'Uric Acid'] },
  { category: 'Hormonal & Markers', items: ['Thyroid Profile (T3,T4,TSH)', 'Vitamin B12', 'Vitamin D3', 'CRP', 'Serum Ferritin'] },
  { category: 'Urine & Stool', items: ['Urine Routine', 'Urine Culture', 'Stool Routine', 'Stool Occult Blood'] },
  { category: 'Imaging & Cardio', items: ['X-Ray Chest', 'ECG', 'ECHO', 'USG Abdomen', 'USG KUB'] }
];

// --- RX DICTIONARIES ---
const RX_ROUTES = ['Oral', 'Topical', 'Injection', 'Inhalation', 'Eye', 'Ear', 'Nasal', 'Sublingual', 'Vaginal'];
const RX_TIMINGS = ['Empty Stomach', 'Before Meal', 'After Meal', 'Early Morning', 'At Night', 'Any Time / SOS'];
const RX_FREQUENCIES = ['One time a day', 'Two times a day', 'Three times a day', 'Four times a day', 'Every alternate day', 'Weekly once', 'SOS (As Needed)'];
const RX_DURATIONS = ['1 Day', '3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '1 Month'];

const COMMON_MEDS = [
  { name: 'Tab Paracetamol 500mg', route: 'Oral', quantity: '1', frequency: 'SOS (As Needed)', timing: 'Any Time / SOS', duration: '3 Days', instructions: '' },
  { name: 'Tab Pantoprazole 40mg', route: 'Oral', quantity: '1', frequency: 'One time a day', timing: 'Empty Stomach', duration: '5 Days', instructions: '' },
  { name: 'Cap Amoxicillin 500mg', route: 'Oral', quantity: '1', frequency: 'Two times a day', timing: 'After Meal', duration: '5 Days', instructions: '' },
  { name: 'Syp Cetirizine 5ml', route: 'Oral', quantity: '5ml', frequency: 'One time a day', timing: 'At Night', duration: '3 Days', instructions: '' },
];

const ConsultationPad = ({ activeAppt, onComplete, isSubmitting }) => {
  const loggedInDoctorId = localStorage.getItem('doctorId');
  const loggedInRole = localStorage.getItem('userRole') || 'admin';

  // --- STATE ---
  const [patientHistory, setPatientHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [selectedPastVisit, setSelectedPastVisit] = useState(null);

  const [vitals, setVitals] = useState({ bp: activeAppt?.vitals?.bp || '', temp: activeAppt?.vitals?.temp || '', weight: activeAppt?.vitals?.weight || '' });
  const [complaintsList, setComplaintsList] = useState([]);
  const [complaintInputText, setComplaintInputText] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState({ diagnosis: '', advice: '' });

  // --- UPGRADED RX STATE ---
  const [medicines, setMedicines] = useState([]);
  const [currentMed, setCurrentMed] = useState({
    name: '', route: 'Oral', quantity: '1', frequency: 'Two times a day', timing: 'After Meal', duration: '5 Days', instructions: ''
  });
  const [isCustomRegimen, setIsCustomRegimen] = useState(false);

  const [labTests, setLabTests] = useState([]);
  const [labInputText, setLabInputText] = useState('');

  const [showRxSuggestions, setShowRxSuggestions] = useState(false);
  const [isMedSelected, setIsMedSelected] = useState(false);

  const [activeSheet, setActiveSheet] = useState(null);
  const [sheetSearch, setSheetSearch] = useState('');
  const [tempComplaintSelection, setTempComplaintSelection] = useState([]);
  const [tempLabSelection, setTempLabSelection] = useState([]);



  // --- SMART RX FORMATTER ---
  const getFormattedUnit = (med) => {
    if (med.duration === 'Custom') return med.quantity;

    let unit = '';
    const nameLower = med.name.toLowerCase();

    if (nameLower.startsWith('tab') || nameLower.includes(' tab')) unit = 'Tab';
    else if (nameLower.startsWith('cap') || nameLower.includes(' cap')) unit = 'Cap';
    else if (nameLower.startsWith('syp') || nameLower.includes('syrup')) unit = 'ml';
    else if (nameLower.includes('drop')) unit = 'Drop';
    else if (nameLower.startsWith('inj') || nameLower.includes('injection')) unit = 'Amp';

    const hasLetters = /[a-zA-Z]/.test(med.quantity);
    return hasLetters ? med.quantity : `${med.quantity} ${unit}`.trim();
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (activeAppt?.patientId?._id || activeAppt?.patientId) {
      setIsHistoryLoading(true);
      const clinicId = localStorage.getItem('clinicId');
      const pId = activeAppt.patientId._id || activeAppt.patientId;
      fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=history&patientId=${pId}`)
        .then(res => res.json())
        .then(data => {
          const todayStr = new Date().toISOString().split('T')[0];

          const validHistory = filterValidHistory(data, activeAppt._id);

          const enhancedData = validHistory.map(visit => ({
            ...visit,
            vitals: visit.vitals || { bp: '120/80', temp: '98.6', weight: '70' },
            complaints: visit.complaints || 'Fever, Headache',
            diagnosis: visit.diagnosis || 'Viral Pyrexia',
            advice: visit.advice || 'Rest for 3 days, drink warm fluids.',
            labTests: visit.labTests || [{ name: 'CBC' }, { name: 'Lipid Profile' }],
            medicines: visit.medicines || [
              { id: Math.random(), name: 'Tab Paracetamol 500mg', route: 'Oral', quantity: '1', frequency: 'Three times a day', timing: 'After Meal', duration: '3 Days', instructions: '' }
            ]
          }));
          setPatientHistory(enhancedData);
          if (enhancedData.length > 0) setIsHistoryExpanded(true);
        })
        .catch(err => console.error(err))
        .finally(() => setIsHistoryLoading(false));
    }
  }, [activeAppt]);

  // --- HANDLERS ---
  const handleRefillRx = (pastMeds) => {
    const clonedMeds = pastMeds.map(m => ({ ...m, id: Date.now() + Math.random() }));
    setMedicines(prev => [...prev, ...clonedMeds]);
    setSelectedPastVisit(null);
    setIsHistoryExpanded(false);
  };

  const handleAddComplaintToken = (text) => {
    const trimmed = text.trim();
    if (trimmed && !complaintsList.includes(trimmed)) setComplaintsList([...complaintsList, trimmed]);
    setComplaintInputText('');
  };

  const handleRemoveComplaintToken = (tokenToRemove) => setComplaintsList(complaintsList.filter(c => c !== tokenToRemove));

  const handleComplaintKeyDown = (e) => {
    if (e.key === ',' || e.key === 'Enter') { e.preventDefault(); handleAddComplaintToken(complaintInputText); }
    else if (e.key === 'Backspace' && complaintInputText === '' && complaintsList.length > 0) handleRemoveComplaintToken(complaintsList[complaintsList.length - 1]);
  };

  const openComplaintSheet = () => { setSheetSearch(''); setTempComplaintSelection([...complaintsList]); setActiveSheet('complaints'); };
  const toggleComplaintInSheet = (item) => setTempComplaintSelection(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  const confirmComplaintSheet = () => { setComplaintsList(tempComplaintSelection); setActiveSheet(null); };

  const handleAddLabToken = (text) => {
    const trimmed = text.trim();
    if (trimmed && !labTests.find(t => t.name.toLowerCase() === trimmed.toLowerCase())) setLabTests([...labTests, { name: trimmed, id: Date.now() + Math.random() }]);
    setLabInputText('');
  };

  const handleRemoveLabToken = (idToRemove) => setLabTests(labTests.filter(t => t.id !== idToRemove));

  const handleLabKeyDown = (e) => {
    if (e.key === ',' || e.key === 'Enter') { e.preventDefault(); handleAddLabToken(labInputText); }
    else if (e.key === 'Backspace' && labInputText === '' && labTests.length > 0) handleRemoveLabToken(labTests[labTests.length - 1].id);
  };

  const openLabSheet = () => { setSheetSearch(''); setTempLabSelection(labTests.map(t => t.name)); setActiveSheet('labs'); };
  const toggleLabInSheet = (itemName) => setTempLabSelection(prev => prev.includes(itemName) ? prev.filter(i => i !== itemName) : [...prev, itemName]);
  const confirmLabSheet = () => {
    const newLabTests = tempLabSelection.map(name => {
      const existing = labTests.find(t => t.name === name);
      return existing ? existing : { name, id: Date.now() + Math.random() };
    });
    setLabTests(newLabTests); setActiveSheet(null);
  };

  const handleSelectPresetMed = (med) => { setCurrentMed(med); setIsMedSelected(true); setShowRxSuggestions(false); setIsCustomRegimen(false); };
  const handleSelectCustomMed = () => { if (!currentMed.name.trim()) return; setIsMedSelected(true); setShowRxSuggestions(false); };

  const handleAddMedicine = () => {
    if (!currentMed.name) return;
    setMedicines([...medicines, { ...currentMed, id: Date.now() }]);
    setCurrentMed({ name: '', route: 'Oral', quantity: '1', frequency: 'Two times a day', timing: 'After Meal', duration: '5 Days', instructions: '' });
    setIsMedSelected(false); setShowRxSuggestions(false); setIsCustomRegimen(false);
  };

  const handleSave = (finalStatus) => {
    const prescriptionData = { vitals, complaints: complaintsList.join(', '), diagnosis: clinicalNotes.diagnosis, advice: clinicalNotes.advice, medicines, labTests };
    onComplete(activeAppt._id, prescriptionData, finalStatus);
  };

  const filteredMeds = COMMON_MEDS.filter(m => m.name.toLowerCase().includes(currentMed.name.toLowerCase()));

  // --- RENDER HELPERS ---
  const renderBottomSheet = () => {
    if (!activeSheet) return null;
    const isComplaints = activeSheet === 'complaints';
    const title = isComplaints ? 'Select Chief Complaints' : 'Select Lab Tests';
    const dataList = isComplaints ? ALL_COMPLAINTS : ALL_LABS;
    const totalCount = dataList.reduce((acc, cat) => acc + cat.items.length, 0);
    const filteredData = dataList.map(category => ({
      ...category, items: category.items.filter(item => item.toLowerCase().includes(sheetSearch.toLowerCase()))
    })).filter(category => category.items.length > 0);
    const selectedCount = isComplaints ? tempComplaintSelection.length : tempLabSelection.length;

    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/40 flex flex-col justify-end backdrop-blur-sm animate-fadeIn">
        <div className="bg-slate-50 w-full h-[85vh] md:h-[80vh] md:max-w-2xl md:mx-auto md:mb-6 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center z-10 min-h-[48px]">
            <div>
              <h3 className="text-[14px] font-bold text-slate-800">{title}</h3>
              <p className="text-[11px] text-slate-500 font-medium">Browse from {totalCount} items</p>
            </div>
            <button type="button" onClick={() => setActiveSheet(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={16} /></button>
          </div>
          <div className="p-2 bg-white border-b border-slate-100 shadow-sm z-10">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] outline-none focus:border-teal-400 focus:bg-white transition-colors" value={sheetSearch} onChange={e => setSheetSearch(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredData.length > 0 ? filteredData.map(category => (
              <div key={category.category}>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">{category.category} <div className="h-px bg-slate-200 flex-1"></div></h4>

                {/* --- MODAL LIST REDESIGNED TO UNIFIED THEME --- */}
                <div className="flex flex-wrap gap-2">
                  {category.items.map(item => {
                    const isSelected = isComplaints ? tempComplaintSelection.includes(item) : tempLabSelection.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => isComplaints ? toggleComplaintInSheet(item) : toggleLabInSheet(item)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors shadow-sm ${isSelected
                            ? 'bg-teal-100 text-teal-800 border-teal-200'
                            : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                          }`}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            )) : <div className="text-center py-10 text-slate-400 text-[12px]">No matching items found.</div>}
          </div>
          <div className="p-3 bg-white border-t border-slate-200">
            <button type="button" onClick={isComplaints ? confirmComplaintSheet : confirmLabSheet} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[13px] rounded-xl shadow-md transition-all active:scale-[0.98]">
              Done {selectedCount > 0 ? `(${selectedCount} Selected)` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Ensure at least one clinical field is filled before allowing submission
  const isFormValid =
    complaintsList.length > 0 ||
    clinicalNotes.diagnosis.trim() !== '' ||
    medicines.length > 0 ||
    labTests.length > 0 ||
    clinicalNotes.advice.trim() !== '';

  // --- MAIN RENDER ---
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide pb-20">

        {/* --- SMART HISTORY ACCORDION --- */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full p-2 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center"><History size={14} /></div>
              <div className="text-left">
                <div className="text-[12px] font-bold text-slate-800 leading-tight">Past History <span className="text-slate-400 font-normal">({patientHistory.length} Visits)</span></div>
              </div>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`} />
          </button>

          {isHistoryExpanded && (
            <div className="p-2 bg-slate-50/50 border-t border-slate-100">
              <PatientHistoryList
                historyData={patientHistory}
                isLoading={isHistoryLoading}
                layout="horizontal"
                onVisitClick={(visit) => setSelectedPastVisit(visit)}
              />
            </div>
          )}
        </section>

        {/* --- EMR WRAPPER --- */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-2 space-y-3">

          {/* VITALS SECTION */}
          <section>
            <div className="flex justify-between items-center mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <Activity size={14} /> Vitals (Triage)
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Blood Pressure</label>
                <input type="text" placeholder="120/80" className="w-full p-2 border border-slate-200 rounded-lg text-[12px] bg-slate-50 outline-none focus:border-teal-400 focus:bg-white" value={vitals.bp} onChange={e => setVitals({ ...vitals, bp: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Temp (°F)</label>
                <input type="text" placeholder="98.6" className="w-full p-2 border border-slate-200 rounded-lg text-[12px] bg-slate-50 outline-none focus:border-teal-400 focus:bg-white" value={vitals.temp} onChange={e => setVitals({ ...vitals, temp: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Weight (Kg)</label>
                <input type="text" placeholder="70" className="w-full p-2 border border-slate-200 rounded-lg text-[12px] bg-slate-50 outline-none focus:border-teal-400 focus:bg-white" value={vitals.weight} onChange={e => setVitals({ ...vitals, weight: e.target.value })} />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* CLINICAL NOTES SECTION */}
          <section>
            <div className="flex justify-between items-end mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <FileText size={14} /> Clinical Notes
              </h3>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Chief Complaints</label>

                {/* --- QUICK LIST (COMPLAINTS) --- */}
                <div className="flex gap-2 overflow-x-auto mb-2 pb-2 w-full custom-scrollbar-hide">
                  {TOP_COMPLAINTS.map(chip => {
                    const isSelected = complaintsList.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAddComplaintToken(chip)}
                        disabled={isSelected}
                        className={`flex-none px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border shadow-sm ${isSelected
                            ? 'bg-teal-100 text-teal-800 border-teal-200 cursor-not-allowed'
                            : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                          }`}
                      >
                        + {chip}
                      </button>
                    );
                  })}
                  <button type="button" onClick={openComplaintSheet} className="flex-none px-2.5 py-1 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 transition-colors shadow-sm">
                    View All <ChevronRight size={12} />
                  </button>
                </div>

                <div
                  className="flex flex-wrap items-center gap-1.5 w-full p-2 border border-slate-200 rounded-lg bg-white focus-within:border-teal-400 transition-colors cursor-text min-h-[38px]"
                  onClick={() => document.getElementById('complaint-token-input').focus()}
                >
                  {complaintsList.map((token, idx) => (
                    <span key={idx} className="bg-teal-100 text-teal-800 border border-teal-200 px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 shadow-sm">
                      {token}
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveComplaintToken(token); }} className="text-teal-500 hover:text-red-500 focus:outline-none"><X size={12} /></button>
                    </span>
                  ))}
                  <input id="complaint-token-input" type="text" autoComplete="off" className="flex-1 w-0 min-w-[20px] bg-transparent outline-none text-[12px] text-slate-800 placeholder-slate-400 m-0 p-0 border-none shadow-none ring-0" placeholder={complaintsList.length === 0 ? "Select from above or type and press comma..." : ""} value={complaintInputText} onChange={(e) => setComplaintInputText(e.target.value)} onKeyDown={handleComplaintKeyDown} onBlur={() => { if (complaintInputText) handleAddComplaintToken(complaintInputText); }} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Provisional Diagnosis</label>
                <input type="text" placeholder="e.g. Viral Pyrexia" className="w-full p-2 border border-slate-200 rounded-lg text-[12px] bg-slate-50 outline-none focus:border-teal-400 focus:bg-white" value={clinicalNotes.diagnosis} onChange={e => setClinicalNotes({ ...clinicalNotes, diagnosis: e.target.value })} />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* --- UPGRADED PRESCRIPTION (Rx) BUILDER --- */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5 mb-1.5">
              <Pill size={14} /> Rx / Medication
            </h3>

            <div className="p-2 bg-teal-50/30 border border-teal-100 rounded-xl space-y-2 mb-2 shadow-sm">

              {/* Row 1: Search Medicine */}
              {isMedSelected ? (
                <div className="flex items-center justify-between p-2 border rounded-lg bg-white border-teal-200 shadow-inner">
                  <div className="flex items-center gap-2">
                    <div className="bg-teal-100 p-1.5 rounded-md"><Pill size={14} className="text-teal-700" /></div>
                    <div className="truncate">
                      <div className="text-[12px] font-bold text-slate-800 truncate">{currentMed.name}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Selected Medicine</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setIsMedSelected(false); setCurrentMed({ ...currentMed, name: '' }); }} className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" placeholder="Search Medicine..." className="w-full p-2 pl-8 border border-slate-200 rounded-lg text-[12px] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 bg-white" value={currentMed.name} onChange={e => { setCurrentMed({ ...currentMed, name: e.target.value }); setShowRxSuggestions(true); }} onFocus={() => setShowRxSuggestions(true)} onBlur={() => setTimeout(() => setShowRxSuggestions(false), 200)} />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  {showRxSuggestions && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-48 overflow-y-auto">
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); handleSelectCustomMed(); }} className="w-full text-left px-3 py-2.5 text-[12px] font-bold text-teal-600 hover:bg-teal-50 flex items-center gap-2 border-b border-slate-100 transition-colors sticky top-0 bg-white/95 backdrop-blur-sm"><div className="bg-teal-100 p-1 rounded-md"><Plus size={14} className="text-teal-700" /></div> Add Custom Medicine</button>
                      {filteredMeds.length > 0 && currentMed.name.length > 0 ? (
                        filteredMeds.map((med, idx) => (
                          <button type="button" key={idx} onMouseDown={(e) => { e.preventDefault(); handleSelectPresetMed(med); }} className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-teal-50 flex justify-between items-center group transition-colors">
                            <div><div className="text-[12px] font-bold text-slate-700 group-hover:text-teal-700">{med.name}</div><div className="text-[10px] text-slate-400">{med.frequency} • {med.timing}</div></div>
                            <div className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Select</div>
                          </button>
                        ))
                      ) : (currentMed.name.length > 0 && <div className="px-3 py-3 text-[11px] text-slate-400 text-center">No exact match. Click "Add Custom" above.</div>)}
                    </div>
                  )}
                </div>
              )}

              {/* Row 2: Route & Toggle (30/70 Split) */}
              <div className="grid grid-cols-[3fr_7fr] gap-2 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase block">Route</label>
                  <select className="w-full p-2 border border-slate-200 rounded-lg text-[12px] outline-none focus:border-teal-400 bg-white text-slate-700" value={currentMed.route} onChange={e => setCurrentMed({ ...currentMed, route: e.target.value })}>
                    {RX_ROUTES.map(route => <option key={route} value={route}>{route}</option>)}
                  </select>
                </div>
                <div className="flex justify-end pb-0.5">
                  <button type="button" onClick={() => setIsCustomRegimen(!isCustomRegimen)} className="text-[10px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 border border-teal-100 hover:bg-teal-100 px-1 py-1.5 rounded-lg transition-colors w-full h-[34px]">
                    {isCustomRegimen ? "Switch to Standard Routine Dose" : "Switch to Complex Tapering Dose"}
                  </button>
                </div>
              </div>

              {/* Conditional Regimen Builder */}
              {isCustomRegimen ? (
                <div className="animate-fadeIn pt-1">
                  <textarea
                    rows="3"
                    placeholder="e.g. 1 tab daily for 5 days, then 1/2 tab daily for next 5 days..."
                    className="w-full p-2 border border-teal-300 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-teal-500/20 bg-teal-50/30 resize-none"
                    value={currentMed.frequency}
                    onChange={e => setCurrentMed({ ...currentMed, frequency: e.target.value, duration: 'Custom' })}
                  />
                </div>
              ) : (
                <div className="space-y-2 animate-fadeIn pt-1">

                  {/* Row 3: Quantity & Frequency (30/70 Split) */}
                  <div className="grid grid-cols-[3fr_7fr] gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase block truncate">Quantity</label>
                      <input type="text" placeholder="Qty" className="w-full p-2 border border-slate-200 rounded-lg text-[12px] outline-none text-center focus:border-teal-400 bg-white" value={currentMed.quantity} onChange={e => setCurrentMed({ ...currentMed, quantity: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase block">Frequency</label>
                      <select className="w-full p-2 border border-slate-200 rounded-lg text-[12px] outline-none bg-white text-slate-700" value={currentMed.frequency} onChange={e => setCurrentMed({ ...currentMed, frequency: e.target.value })}>
                        {RX_FREQUENCIES.map(freq => <option key={freq} value={freq}>{freq}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Duration & Timing (30/70 Split) */}
                  <div className="grid grid-cols-[3fr_7fr] gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase block">Duration</label>
                      <select className="w-full p-2 border border-slate-200 rounded-lg text-[12px] outline-none bg-white text-slate-700" value={currentMed.duration} onChange={e => setCurrentMed({ ...currentMed, duration: e.target.value })}>
                        {RX_DURATIONS.map(dur => <option key={dur} value={dur}>{dur}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase block">Timing</label>
                      <select className="w-full p-2 border border-slate-200 rounded-lg text-[12px] outline-none bg-white text-slate-700" value={currentMed.timing} onChange={e => setCurrentMed({ ...currentMed, timing: e.target.value })}>
                        {RX_TIMINGS.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 5: Instructions */}
              <div className="pt-1">
                <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase block">Instructions</label>
                <input type="text" placeholder="Notes (Optional)" className="w-full p-2 border border-slate-200 rounded-lg text-[12px] outline-none bg-white focus:border-teal-400" value={currentMed.instructions} onChange={e => setCurrentMed({ ...currentMed, instructions: e.target.value })} />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button type="button" onClick={handleAddMedicine} disabled={!isMedSelected} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-bold disabled:opacity-50 transition-colors shadow-sm"><Plus size={14} /> Add Medicine to Rx</button>
              </div>
            </div>

            {/* Added Medicines List Display */}
            {medicines.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {medicines.map((med, index) => (
                  <div key={med.id} className="flex items-start justify-between p-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-[12px] font-bold text-slate-800 truncate">
                        {index + 1}. {med.name}
                      </div>

                      {/* Row 1: Route • Unit • Frequency • Timing */}
                      <div className="text-[11px] text-teal-700 font-bold mt-0.5 flex flex-wrap gap-x-1.5 items-center">
                        <span>{med.route}</span>
                        <span className="text-teal-300">•</span>
                        <span>{getFormattedUnit(med)}</span>
                        <span className="text-teal-300">•</span>
                        <span>{med.frequency}</span>
                        <span className="text-teal-300">•</span>
                        <span className="text-slate-600 font-medium">{med.timing}</span>
                      </div>

                      {/* Row 2: Duration & Notes */}
                      <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-1.5 gap-y-1 items-center">
                        <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{med.duration}</span>
                        {med.instructions && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="italic">Note: {med.instructions}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setMedicines(medicines.filter(m => m.id !== med.id))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0 mt-0.5">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <hr className="border-slate-100" />

          {/* LAB TESTS / DIAGNOSTICS */}
          <section>
            <div className="flex justify-between items-end mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <FlaskConical size={14} /> Lab Tests
              </h3>
            </div>

            {/* --- QUICK LIST (LABS) --- */}
            <div className="flex gap-2 overflow-x-auto mb-2 pb-2 w-full custom-scrollbar-hide">
              {TOP_LABS.map(lab => {
                const isSelected = labTests.some(t => t.name === lab);
                return (
                  <button
                    type="button"
                    key={lab}
                    onClick={() => handleAddLabToken(lab)}
                    disabled={isSelected}
                    className={`flex-none px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border shadow-sm ${isSelected
                        ? 'bg-teal-100 text-teal-800 border-teal-200 cursor-not-allowed'
                        : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                      }`}
                  >
                    + {lab}
                  </button>
                )
              })}
              <button type="button" onClick={openLabSheet} className="flex-none px-2.5 py-1 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 transition-colors shadow-sm">
                View All <ChevronRight size={12} />
              </button>
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5 w-full p-2 border border-slate-200 rounded-lg bg-white focus-within:border-teal-400 transition-colors cursor-text min-h-[38px]"
              onClick={() => document.getElementById('lab-token-input').focus()}
            >
              {labTests.map((test) => (
                <span key={test.id} className="bg-teal-100 text-teal-800 border border-teal-200 px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 shadow-sm">
                  {test.name}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveLabToken(test.id); }} className="text-teal-500 hover:text-red-500 focus:outline-none"><X size={12} /></button>
                </span>
              ))}
              <input id="lab-token-input" type="text" autoComplete="off" className="flex-1 min-w-[20px] bg-transparent outline-none text-[12px] text-slate-800 placeholder-slate-400 m-0 p-0 border-none shadow-none ring-0" placeholder={labTests.length === 0 ? "Select from above or type and press comma..." : ""} value={labInputText} onChange={(e) => setLabInputText(e.target.value)} onKeyDown={handleLabKeyDown} onBlur={() => { if (labInputText) handleAddLabToken(labInputText); }} />
            </div>
          </section>

          {/* ADVICE */}
          <section>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-teal-700 mb-1">General Advice</label>
            <input type="text" placeholder="e.g. Drink plenty of warm water..." className="w-full p-2 border border-slate-200 rounded-lg text-[12px] bg-slate-50 outline-none focus:border-teal-400 focus:bg-white" value={clinicalNotes.advice} onChange={e => setClinicalNotes({ ...clinicalNotes, advice: e.target.value })} />
          </section>
        </div>
      </div>

      {renderBottomSheet()}

      {/* --- DEEP-DIVE / REFILL MODAL --- */}
      {selectedPastVisit && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 flex items-center justify-center p-4 md:p-6 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn border border-slate-200">

            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-[14px] font-bold text-slate-800">Past Visit Records</h2>
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                  {selectedPastVisit.date} 
                  {(String(selectedPastVisit.doctorId?._id || selectedPastVisit.doctorId) !== String(loggedInDoctorId) || getUiStatus(selectedPastVisit) === 'No Show' || getUiStatus(selectedPastVisit) === 'No-Show') && (
                    <> • Dr. {selectedPastVisit.doctorId?.name?.replace(/^Dr\.\s*/i, '') || 'Unknown'}</>
                  )}
                  {/* THIS IS THE NEW CODE */}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase border ${getStatusStyling(getUiStatus(selectedPastVisit)).badge}`}>
                    {getUiStatus(selectedPastVisit)}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPastVisit(null)} className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-full transition-colors"><X size={16} /></button>
            </div>

            <div className="p-4 space-y-5 overflow-y-auto max-h-[60vh] bg-slate-50/30">

              {/* 1. Vitals */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Activity size={12} /> Vitals</h4>
                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">BP</div>
                    <div className="text-[12px] font-medium text-slate-800">{selectedPastVisit.vitals?.bp || '--'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Temp</div>
                    <div className="text-[12px] font-medium text-slate-800">{selectedPastVisit.vitals?.temp ? `${selectedPastVisit.vitals.temp}°F` : '--'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Weight</div>
                    <div className="text-[12px] font-medium text-slate-800">{selectedPastVisit.vitals?.weight ? `${selectedPastVisit.vitals.weight} kg` : '--'}</div>
                  </div>
                </div>
              </div>

              {/* 2 & 3. Complaints & Diagnosis */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Clinical Notes</h4>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Chief Complaints</div>
                    <div className="text-[12px] font-medium text-slate-800 leading-relaxed">{selectedPastVisit.complaints || '--'}</div>
                  </div>
                  <div className="pt-2 border-t border-slate-50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Provisional Diagnosis</div>
                    <div className="text-[13px] font-bold text-teal-800">{selectedPastVisit.diagnosis || '--'}</div>
                  </div>
                </div>
              </div>

              {/* 4. Medicines (Updated Display for Deep Dive) */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><Pill size={12} /> Prescribed Medicines</span>
                  <span className="text-teal-600 bg-teal-50 px-2 py-0.5 rounded">{selectedPastVisit.medicines?.length || 0} Items</span>
                </h4>
                {selectedPastVisit.medicines && selectedPastVisit.medicines.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {selectedPastVisit.medicines.map((med, index) => (
                      <div key={index} className="flex flex-col p-2.5 border-b border-slate-100 last:border-0">
                        <div className="text-[12px] font-bold text-slate-800">{index + 1}. {med.name}</div>

                        {/* Row 1: Route • Unit • Frequency • Timing */}
                        <div className="text-[11px] text-teal-700 font-bold mt-0.5 flex flex-wrap gap-x-1.5 items-center">
                          <span>{med.route}</span>
                          <span className="text-teal-300">•</span>
                          <span>{getFormattedUnit(med)}</span>
                          <span className="text-teal-300">•</span>
                          <span>{med.frequency}</span>
                          <span className="text-teal-300">•</span>
                          <span className="text-slate-600 font-medium">{med.timing}</span>
                        </div>

                        {/* Row 2: Duration & Notes */}
                        <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-1.5 gap-y-1 items-center">
                          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{med.duration}</span>
                          {med.instructions && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span className="italic">Note: {med.instructions}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-slate-400 text-[11px] bg-white rounded-xl border border-slate-100 shadow-sm">No medicines prescribed.</div>
                )}
              </div>

              {/* 5. Lab Tests */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FlaskConical size={12} /> Lab Tests Ordered</h4>
                {selectedPastVisit.labTests && selectedPastVisit.labTests.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    {selectedPastVisit.labTests.map((test, idx) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[11px] font-medium border border-blue-100">
                        {test.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-slate-400 text-[11px] bg-white rounded-xl border border-slate-100 shadow-sm">No lab tests ordered.</div>
                )}
              </div>

              {/* 6. Advice */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">General Advice</h4>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[12px] font-medium text-slate-800 italic">{selectedPastVisit.advice || '--'}</p>
                </div>
              </div>

            </div>

            {/* Refill Action Button */}
            {selectedPastVisit.medicines && selectedPastVisit.medicines.length > 0 && (
              <div className="p-3 bg-white border-t border-slate-200">
                <button type="button" onClick={() => handleRefillRx(selectedPastVisit.medicines)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] rounded-xl shadow-md transition-all active:scale-[0.98] flex justify-center items-center gap-2">
                  <RotateCw size={14} /> Repeat Medicines from this Visit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIXED BOTTOM ACTION BAR (Consolidated Smart CTA) */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 z-40" style={{ boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
          <button 
              type="button" 
              onClick={() => handleSave('Completed')} 
              disabled={isSubmitting || !isFormValid} 
              className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[13px] font-bold flex justify-center items-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {labTests.length > 0 ? (
                  <FlaskConical size={18} />
                ) : (
                  <CheckCircle size={18} />
                )}
                Mark as Complete
              </>
            )}
          </button>
      </div>
    </div>
  );
};

export default ConsultationPad;