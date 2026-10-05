
import React, { useState, useMemo, useEffect } from 'react';
import { Patient, PatientStatus, Gender, HospitalUnit, IsolationType, Collaborator, PendingTask, DischargePrediction } from '../types';
import { X, Save, AlertCircle, Trash2, Biohazard, ShieldCheck, UserPlus, Clock, Plus, Calendar, Calculator, RefreshCw, CheckCircle2, AlertTriangle, Target, History as HistoryIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSave: (patient: Partial<Patient>) => void;
  onDelete?: (id: string) => void;
  initialData?: Patient;
  predefinedBed?: string;
  predefinedUnit?: string;
  units: HospitalUnit[];
  patients: Patient[];
}

const PatientForm: React.FC<Props> = ({ onClose, onSave, onDelete, initialData, predefinedBed, predefinedUnit, units, patients }) => {
  const getBrasiliaISO = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
  };

  const formatForInput = (dateStr?: string) => {
    if (!dateStr) return getBrasiliaISO();
    try {
      const date = new Date(dateStr);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch(e) { return getBrasiliaISO(); }
  };

  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
    } catch(e) { return ''; }
  };

  const [formData, setFormData] = useState<Partial<Patient>>(() => {
    if (initialData && initialData.id) {
      return {
        ...initialData,
        entryDateHospital: formatForInput(initialData.entryDateHospital),
        admissionDate: formatForInput(initialData.admissionDate),
        predictedDischargeDate: formatDateForInput(initialData.predictedDischargeDate),
      };
    }
    return {
      unitId: predefinedUnit || '',
      bed: predefinedBed || '',
      sesId: '',
      name: '',
      gender: Gender.M,
      age: 0,
      entryDateHospital: getBrasiliaISO(),
      admissionDate: getBrasiliaISO(),
      origin: '',
      diagnosis: '',
      etiologicalAgent: '',
      pendingTasks: [],
      status: PatientStatus.ADMITTED,
      isolationType: IsolationType.NONE,
      isExtra: false,
      predictedDischargeDate: '',
    };
  });

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferType, setTransferType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [destUnitId, setDestUnitId] = useState('');
  const [destBed, setDestBed] = useState('');
  const [externalDest, setExternalDest] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState('');

  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [validityMode, setValidityMode] = useState<'DATE' | 'DAYS'>('DATE');
  const [validityDate, setValidityDate] = useState('');
  const [validityDays, setValidityDays] = useState('');

  const [predictionReason, setPredictionReason] = useState('');
  const isEditing = !!(initialData && initialData.id);

  useEffect(() => {
    if (formData.status === PatientStatus.TRANSFERRED) {
      setIsTransferring(true);
      if (initialData?.externalDestination) {
        setTransferType('EXTERNAL');
        setExternalDest(initialData.externalDestination);
      }
    } else {
      setIsTransferring(false);
    }
  }, [formData.status, initialData]);

  const activeUnit = useMemo(() => 
    units.find(u => u.id === (isTransferring && transferType === 'INTERNAL' ? destUnitId : formData.unitId)),
    [units, formData.unitId, destUnitId, isTransferring, transferType]
  );

  const availableBeds = useMemo(() => {
    if (!activeUnit) return [];
    const unitIdToCheck = (isTransferring && transferType === 'INTERNAL') ? destUnitId : formData.unitId;
    const occupiedBeds = patients
      .filter(p => p.unitId === unitIdToCheck && p.id !== initialData?.id && ![PatientStatus.DISCHARGED, PatientStatus.DECEASED, PatientStatus.EVASION, PatientStatus.TRANSFERRED].includes(p.status))
      .map(p => p.bed);
    
    const beds = [];
    for (let i = 1; i <= activeUnit.capacity; i++) {
      const bedNum = `${i}`;
      if (!occupiedBeds.includes(bedNum) || bedNum === formData.bed) beds.push(bedNum);
    }
    return beds;
  }, [activeUnit, patients, formData.unitId, destUnitId, isTransferring, transferType, initialData, formData.bed]);

  const addTask = () => {
    if (!newTaskDesc) return;
    
    let expiresAt: string | undefined = undefined;
    if (validityMode === 'DATE' && validityDate) {
      expiresAt = new Date(validityDate).toISOString();
    } else if (validityMode === 'DAYS' && validityDays) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(validityDays));
      expiresAt = d.toISOString();
    }

    const task: PendingTask = {
      id: Math.random().toString(36).substring(2, 9),
      description: newTaskDesc.toUpperCase(),
      createdAt: new Date().toISOString(),
      expiresAt
    };
    setFormData(prev => ({ ...prev, pendingTasks: [...(prev.pendingTasks || []), task] }));
    setNewTaskDesc('');
    setValidityDate('');
    setValidityDays('');
  };

  const removeTask = (id: string) => {
    setFormData(prev => ({ ...prev, pendingTasks: prev.pendingTasks?.filter(t => t.id !== id) }));
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.status === PatientStatus.DELETED) {
      setShowDeleteConfirm(true);
      return;
    }

    // Validação de campos obrigatórios
    if (!formData.name || !formData.sesId) {
        toast.error("O Nome e o SES do paciente são obrigatórios.");
        return;
    }

    if (!isTransferring && (!formData.unitId || !formData.bed)) {
      toast.error("ERRO: Unidade e Leito são obrigatórios.");
      return;
    }

    if (isEditing && (formData.status !== initialData?.status || isTransferring || formData.unitId !== initialData?.unitId)) {
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = () => {
    const currentPredictions: DischargePrediction[] = [...(initialData?.dischargePredictions || [])];
    const prevDate = formatDateForInput(initialData?.predictedDischargeDate);
    const newDate = formData.predictedDischargeDate;

    if (newDate && (newDate !== prevDate || currentPredictions.length === 0)) {
      const isFirst = currentPredictions.length === 0;
      currentPredictions.push({
        id: String(Date.now()),
        predictedDate: newDate,
        reason: predictionReason.trim() || (isFirst ? 'Previsão inicial de alta do PTS' : 'Reprogramação do Projeto Terapêutico Singular'),
        createdAt: new Date().toISOString(),
        previousDate: prevDate || undefined
      });
    }

    const patientPayload: Partial<Patient> = {
      ...formData,
      predictedDischargeDate: newDate || undefined,
      dischargePredictions: currentPredictions
    };

    if (isTransferring) {
      if (transferType === 'INTERNAL') {
        onSave({ 
          ...patientPayload, 
          unitId: destUnitId, 
          bed: destBed, 
          status: PatientStatus.ADMITTED 
        });
      } else {
        onSave({ 
          ...patientPayload, 
          status: PatientStatus.TRANSFERRED, 
          externalDestination: externalDest, 
          dischargeDate: new Date().toISOString() 
        });
      }
    } else {
      const isDischarging = [PatientStatus.DISCHARGED, PatientStatus.DECEASED, PatientStatus.EVASION].includes(formData.status as PatientStatus);
      onSave({
        ...patientPayload,
        ...(isDischarging && !patientPayload.dischargeDate ? { dischargeDate: new Date().toISOString() } : {})
      });
    }
  };

  const handleConfirmPassword = () => {
    if (password === '1234') { 
      setShowConfirmModal(false);
      executeSave();
    } else {
      toast.error("Senha incorreta.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const filteredStatuses = Object.values(PatientStatus).filter(s => {
    if (s === PatientStatus.BLOCKED) return false;
    if (!isEditing && s === PatientStatus.DELETED) return false;
    return true;
  });

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-[2.5rem]">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {isEditing ? 'Auditoria de Atendimento' : 'Nova Admissão'}
              </h2>
              <p className="text-xs font-black text-indigo-500 mt-1 uppercase tracking-widest">Protocolo Regional HRT</p>
            </div>
            <button onClick={onClose} type="button" className="p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <X size={28} />
            </button>
          </div>
          
          <form onSubmit={validateAndSubmit} className="p-8 overflow-y-auto space-y-8 no-scrollbar">
            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                <AlertCircle size={14} /> Dados do Paciente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nome Completo</label>
                  <input required name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none uppercase" placeholder="NOME DO PACIENTE" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">SES (Prontuário)</label>
                  <input required name="sesId" value={formData.sesId || ''} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="000.000.000" />
                </div>
                
                <div className="md:col-span-3">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Sexo</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none">
                    <option value={Gender.M}>Masculino</option>
                    <option value={Gender.F}>Feminino</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Idade</label>
                  <input type="number" required name="age" value={formData.age || 0} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none" />
                </div>
                <div className="md:col-span-6">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Procedência / Origem</label>
                  <input required name="origin" value={formData.origin || ''} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none uppercase" placeholder="Ex: UPA, SAMU, PS..." />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} /> Cronologia de Internação & Projeto Terapêutico Singular (PTS)
                </h3>
                {formData.predictedDischargeDate && (
                  <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5">
                    <Target size={12} /> Meta de Alta Ativa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4 relative">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Entrada Hospital (Permanente)</label>
                  <Calendar className="absolute right-4 top-[46px] text-indigo-400 z-10 pointer-events-none" size={18} />
                  <input 
                    required 
                    disabled={isEditing}
                    type="datetime-local" 
                    name="entryDateHospital" 
                    value={formData.entryDateHospital || ''} 
                    onChange={handleChange} 
                    className={`w-full bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl font-bold text-slate-900 outline-none pr-12 ${isEditing ? 'opacity-60 grayscale cursor-not-allowed' : ''}`} 
                  />
                </div>
                <div className="md:col-span-4 relative">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Admissão Setor (Retroativo)</label>
                  <Clock className="absolute right-4 top-[46px] text-indigo-400 z-10 pointer-events-none" size={18} />
                  <input required type="datetime-local" name="admissionDate" value={formData.admissionDate || ''} onChange={handleChange} className="w-full bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl font-bold text-slate-900 outline-none pr-12" />
                </div>
                <div className="md:col-span-4 relative">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                      Previsibilidade de Alta (Meta PTS)
                    </label>
                  </div>
                  <div className="relative">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 z-10 pointer-events-none" size={18} />
                    <input 
                      type="date" 
                      name="predictedDischargeDate" 
                      value={formData.predictedDischargeDate || ''} 
                      onChange={handleChange} 
                      className="w-full bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl font-bold text-slate-900 outline-none pr-12 focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>

                  {/* Botões de Preenchimento Rápido de Previsão */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: 'Hoje', days: 0 },
                      { label: '+2d', days: 2 },
                      { label: '+3d', days: 3 },
                      { label: '+5d', days: 5 },
                      { label: '+7d', days: 7 },
                      { label: '+10d', days: 10 },
                      { label: '+15d', days: 15 }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + preset.days);
                          const tzOffset = d.getTimezoneOffset() * 60000;
                          const dateStr = new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
                          setFormData(prev => ({ ...prev, predictedDischargeDate: dateStr }));
                        }}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border border-indigo-200/80 rounded-lg text-[9px] font-black text-indigo-700 transition-colors shadow-2xs"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {formData.predictedDischargeDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, predictedDischargeDate: '' }));
                          setPredictionReason('');
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg text-[9px] font-bold text-slate-500 hover:text-red-600 transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloco de Justificativa e Histórico do PTS */}
              {formData.predictedDischargeDate && (
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase flex items-center gap-2">
                        <Target size={16} className="text-indigo-600" />
                        {initialData?.predictedDischargeDate && formData.predictedDischargeDate !== formatDateForInput(initialData.predictedDischargeDate)
                          ? 'Reprogramação do Projeto Terapêutico Singular (PTS)'
                          : 'Meta e Planejamento da Previsão de Alta (PTS)'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {initialData?.predictedDischargeDate && formData.predictedDischargeDate !== formatDateForInput(initialData.predictedDischargeDate)
                          ? `A alteração da data anterior (${new Date(initialData.predictedDischargeDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}) será arquivada para fins de auditoria e cálculo da taxa de sucesso.`
                          : 'Defina a meta clínica de desospitalização baseada no plano multidisciplinar.'}
                      </p>
                    </div>

                    {(() => {
                      const nowDay = new Date();
                      nowDay.setHours(0,0,0,0);
                      const [y, m, d] = formData.predictedDischargeDate.split('-').map(Number);
                      const target = new Date(y, m-1, d);
                      target.setHours(0,0,0,0);
                      const diffDays = Math.round((target.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) {
                        return (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase flex items-center gap-1 border border-red-200">
                            <AlertTriangle size={12} /> Data no Passado ({Math.abs(diffDays)}d atrás)
                          </span>
                        );
                      }
                      if (diffDays === 0) {
                        return (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[9px] font-black uppercase flex items-center gap-1 border border-amber-200">
                            <Clock size={12} /> Previsão para Hoje
                          </span>
                        );
                      }
                      return (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase flex items-center gap-1 border border-emerald-200">
                          <CheckCircle2 size={12} /> Em {diffDays} {diffDays === 1 ? 'dia' : 'dias'}
                        </span>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {initialData?.predictedDischargeDate && formData.predictedDischargeDate !== formatDateForInput(initialData.predictedDischargeDate)
                        ? 'Justificativa do Recálculo do PTS (Por que a previsão anterior mudou?)'
                        : 'Motivo / Condição Terapêutica da Previsão'}
                    </label>
                    <input 
                      type="text" 
                      value={predictionReason} 
                      onChange={e => setPredictionReason(e.target.value)} 
                      placeholder={initialData?.predictedDischargeDate && formData.predictedDischargeDate !== formatDateForInput(initialData.predictedDischargeDate)
                        ? "Ex: Piora do padrão respiratório / Necessidade de estender antibioticoterapia..."
                        : "Ex: Melhora clínica esperada em 3 dias / Aguardando apenas desmame de O2..."}
                      className="w-full bg-white border border-slate-200 p-3.5 rounded-xl font-medium text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  {/* Linha do Tempo de Previsões Anteriores */}
                  {initialData?.dischargePredictions && initialData.dischargePredictions.length > 0 && (
                    <div className="pt-3 border-t border-slate-200/80">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <HistoryIcon size={12} className="text-slate-400" />
                        Histórico de Previsões do PTS Registradas ({initialData.dischargePredictions.length})
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {initialData.dischargePredictions.map((pred, i) => (
                          <div key={pred.id || i} className="p-3 bg-white rounded-xl border border-slate-200/70 text-xs flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[9px] uppercase">
                                  {i + 1}ª Previsão
                                </span>
                                <span className="font-bold text-slate-900">
                                  {new Date(pred.predictedDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </span>
                                {pred.previousDate && (
                                  <span className="text-[10px] text-slate-400 line-through">
                                    Ant: {new Date(pred.previousDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 font-medium mt-1">
                                {pred.reason || 'Sem justificativa informada'}
                              </p>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold shrink-0">
                              {new Date(pred.createdAt).toLocaleDateString('pt-BR')} às {new Date(pred.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                <Biohazard size={14} /> Alocação e Fluxo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-5 rounded-[2rem] border-2 transition-all ${formData.isExtra ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
                  <label className="flex items-center cursor-pointer select-none">
                    <div className="relative">
                      <input type="checkbox" name="isExtra" checked={formData.isExtra || false} onChange={handleChange} className="sr-only" />
                      <div className={`w-12 h-6 rounded-full transition-colors ${formData.isExtra ? 'bg-purple-600' : 'bg-slate-300'}`}></div>
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isExtra ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <span className="ml-4 text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><UserPlus size={16} /> Leito Extra</span>
                  </label>
                </div>

                <div className={`p-5 rounded-[2rem] border-2 transition-all ${formData.isolationType !== IsolationType.NONE ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                  <label className="flex items-center cursor-pointer select-none">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={formData.isolationType !== IsolationType.NONE} 
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, isolationType: IsolationType.CONTACT }));
                          } else {
                            setFormData(prev => ({ ...prev, isolationType: IsolationType.NONE, etiologicalAgent: '' }));
                          }
                        }} 
                        className="sr-only" 
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${formData.isolationType !== IsolationType.NONE ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isolationType !== IsolationType.NONE ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <span className="ml-4 text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Biohazard size={16} /> Em Isolamento</span>
                  </label>
                </div>
              </div>

              {formData.isolationType !== IsolationType.NONE && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-amber-50 rounded-[2rem] border border-amber-200">
                  <div className="md:col-span-6">
                    <label className="block text-xs font-black text-amber-800 uppercase tracking-widest mb-2">Tipo de Precaução</label>
                    <select name="isolationType" value={formData.isolationType} onChange={handleChange} className="w-full bg-white border-2 border-amber-200 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-amber-500">
                      <option value={IsolationType.CONTACT}>Precaução de Contato</option>
                      <option value={IsolationType.DROPLET}>Precaução por Gotículas</option>
                      <option value={IsolationType.AEROSOL}>Precaução por Aerossóis</option>
                      <option value={IsolationType.NONE}>Precaução Padrão</option>
                    </select>
                  </div>
                  <div className="md:col-span-6">
                    <label className="block text-xs font-black text-amber-800 uppercase tracking-widest mb-2">Microorganismo (Opcional)</label>
                    <input name="etiologicalAgent" value={formData.etiologicalAgent || ''} onChange={handleChange} className="w-full bg-white border-2 border-amber-200 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-amber-500 uppercase" placeholder="Ex: KPC, VRE, COVID-19..." />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {!isTransferring ? (
                  <>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Unidade / Setor</label>
                      <select required name="unitId" value={formData.unitId || ''} onChange={handleChange} className="w-full bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none">
                        <option value="">Selecione a Unidade</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Leito</label>
                      {!formData.isExtra ? (
                        <select required name="bed" value={formData.bed || ''} onChange={handleChange} className="w-full bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none">
                          <option value="">Escolha o Leito</option>
                          {availableBeds.map(b => (
                            <option key={b} value={b}>
                              {activeUnit?.bedNames?.[parseInt(b) - 1] ? `Leito ${activeUnit.bedNames[parseInt(b) - 1]}` : `Leito L-${b}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input required name="bed" value={formData.bed || ''} onChange={handleChange} className="w-full bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none uppercase" placeholder="Ex: C-01" />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-8 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                      <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="transferType" checked={transferType === 'INTERNAL'} onChange={() => setTransferType('INTERNAL')} className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-black text-indigo-900 uppercase">Transferência Interna</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="transferType" checked={transferType === 'EXTERNAL'} onChange={() => setTransferType('EXTERNAL')} className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-black text-indigo-900 uppercase">Transferência Externa</span>
                        </label>
                      </div>

                      {transferType === 'INTERNAL' ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-indigo-800 uppercase mb-1">Unidade Destino</label>
                            <select required value={destUnitId} onChange={e => setDestUnitId(e.target.value)} className="w-full bg-white border border-indigo-200 p-3 rounded-xl font-bold text-slate-900 outline-none">
                              <option value="">Selecione</option>
                              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-indigo-800 uppercase mb-1">Leito Destino</label>
                            {!formData.isExtra ? (
                              <select required value={destBed} onChange={e => setDestBed(e.target.value)} className="w-full bg-white border border-indigo-200 p-3 rounded-xl font-bold text-slate-900 outline-none">
                                <option value="">Selecione</option>
                                {availableBeds.map(b => (
                                  <option key={b} value={b}>
                                    {activeUnit?.bedNames?.[parseInt(b) - 1] ? `Leito ${activeUnit.bedNames[parseInt(b) - 1]}` : `Leito L-${b}`}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input required value={destBed} onChange={e => setDestBed(e.target.value)} className="w-full bg-white border border-indigo-200 p-3 rounded-xl font-bold text-slate-900 outline-none uppercase" placeholder="Ex: C-01" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-black text-indigo-800 uppercase mb-1">Hospital / Local de Destino</label>
                          <input required value={externalDest} onChange={e => setExternalDest(e.target.value)} className="w-full bg-white border border-indigo-200 p-3 rounded-xl font-bold text-slate-900 outline-none uppercase" placeholder="Ex: HOSPITAL DE BASE..." />
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="md:col-span-4">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Status Clínico Principal</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none">
                    {filteredStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Diagnóstico e Clínica</h3>
              <textarea required name="diagnosis" value={formData.diagnosis || ''} onChange={handleChange} rows={5} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 whitespace-pre-wrap uppercase" placeholder="DESCREVA OS DIAGNÓSTICOS (Habilita multi-linha)..." />
            </section>

            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Clock size={14} /> Plano e Pendências</h3>
              
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                       <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Descrição do Item</label>
                       <input value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500" placeholder="EX: TROCA DE CURATIVO, ATB..." />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Modo Validade</label>
                       <select value={validityMode} onChange={e => setValidityMode(e.target.value as any)} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-[10px] uppercase outline-none">
                          <option value="DATE">DATA FIXA</option>
                          <option value="DAYS">PRAZO (DIAS)</option>
                       </select>
                    </div>
                    <div className="md:col-span-3">
                       <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Valor Validade</label>
                       {validityMode === 'DATE' ? (
                          <div className="relative">
                            <Calendar className="absolute right-3 top-3.5 text-indigo-400 pointer-events-none" size={16} />
                            <input type="date" value={validityDate} onChange={e => setValidityDate(e.target.value)} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 pr-10" />
                          </div>
                       ) : (
                          <div className="relative">
                            <Calculator className="absolute right-3 top-3.5 text-indigo-400 pointer-events-none" size={16} />
                            <input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 pr-10" placeholder="DIAS" />
                          </div>
                       )}
                    </div>
                    <div className="md:col-span-2 flex items-end">
                       <button type="button" onClick={addTask} className="w-full bg-indigo-600 text-white h-[52px] rounded-xl font-black text-[10px] uppercase flex items-center justify-center hover:bg-indigo-700 transition-all shadow-md">Add</button>
                    </div>
                 </div>
                 
                 <div className="space-y-3 mt-6">
                    {formData.pendingTasks?.map(task => {
                      const isExpired = task.expiresAt && new Date(task.expiresAt).getTime() < Date.now();
                      return (
                        <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                           <div className="flex flex-col">
                              <span className={`text-[11px] font-black uppercase ${isExpired ? 'text-red-600' : 'text-slate-900'}`}>{task.description}</span>
                              <div className="flex gap-4 mt-1">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase">Criado: {new Date(task.createdAt).toLocaleDateString('pt-BR')}</span>
                                 {task.expiresAt && <span className={`text-[9px] font-black uppercase ${isExpired ? 'text-red-500' : 'text-emerald-500'}`}>Validade: {new Date(task.expiresAt).toLocaleDateString('pt-BR')}</span>}
                              </div>
                           </div>
                           <button type="button" onClick={() => removeTask(task.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                      );
                    })}
                 </div>
              </div>
            </section>

            <div className="pt-8 sticky bottom-0 bg-white/95 backdrop-blur-md z-10 flex gap-4">
               <button type="button" onClick={onClose} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-[1.5rem] uppercase tracking-widest text-[10px] transition-all hover:bg-slate-200">Fechar</button>
               <button type="submit" className={`flex-[2] text-white font-black py-5 rounded-[1.5rem] transition-all shadow-2xl flex items-center justify-center uppercase tracking-widest text-[10px] ${formData.status === PatientStatus.DELETED ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {formData.status === PatientStatus.DELETED ? <Trash2 size={18} className="mr-3" /> : <Save size={18} className="mr-3" />}
                  {formData.status === PatientStatus.DELETED ? 'Executar Exclusão' : 'Salvar Auditoria'}
               </button>
            </div>
          </form>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><ShieldCheck size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase">Validar Ação</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Sua ação será registrada no histórico</p>
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 p-4 rounded-xl font-bold text-center mb-6 outline-none focus:border-indigo-600" placeholder="SENHA MESTRE (1234)" />
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 rounded-xl">Voltar</button>
              <button onClick={handleConfirmPassword} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase">Excluir Registro</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Esta ação é irreversível</p>
            </div>
            <p className="text-sm text-center text-slate-600 font-medium mb-6">
              Tem certeza que deseja excluir permanentemente este registro?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 rounded-xl">Cancelar</button>
              <button onClick={() => { setShowDeleteConfirm(false); onDelete?.(initialData!.id); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PatientForm;
