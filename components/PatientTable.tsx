
import React, { useState, useEffect } from 'react';
import { Patient, PatientPriority, PatientStatus, HospitalUnit, IsolationType } from '../types';
import { calculateStay, getAutoPriority, getDischargePredictionStatus } from '../utils/calculations';
import { Bed, Clock, User, Stethoscope, ClipboardList, Biohazard, ShieldAlert, UserPlus, AlertTriangle, History, Calendar, CheckCircle, RefreshCw } from 'lucide-react';

interface Props {
  unit?: HospitalUnit;
  patients: Patient[];
  onEdit: (patient: Patient) => void;
  onNewAtBed?: (bed: string) => void;
  isGlobalView?: boolean;
  units?: HospitalUnit[];
  onHistoryClick?: (patientId: string) => void;
  onActionClick?: (info: { unitId: string, bed: string, patient?: Patient }) => void;
}

const PatientTable: React.FC<Props> = ({ unit, patients, onEdit, onNewAtBed, isGlobalView, units, onHistoryClick, onActionClick }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getPriorityColor = (priority: PatientPriority) => {
    switch (priority) {
      case PatientPriority.RED: return 'bg-red-500';
      case PatientPriority.YELLOW: return 'bg-yellow-400';
      case PatientPriority.GREEN: return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const formatStay = (stay: { days: number, hours: number, minutes: number }) => {
    const parts = [];
    if (stay.days > 0) parts.push(`${stay.days}d`);
    if (stay.hours > 0 || stay.days > 0) parts.push(`${stay.hours}h`);
    parts.push(`${stay.minutes}m`);
    return parts.join(' ');
  };

  const getElapsedTime = (isoDate: string) => {
    const { days, hours } = calculateStay(isoDate, now);
    if (days === 0 && hours === 0) return 'agora';
    if (days === 0) return `há ${hours}h`;
    return `há ${days}d`;
  };

  const getUnitName = (unitId: string) => {
    return units?.find(u => u.id === unitId)?.name || 'SETOR N/A';
  };

  const rows = [];
  if (!isGlobalView && unit) {
    const patientByBed = new Map<string, Patient>();
    const extraPatients: Patient[] = [];
    
    patients.forEach(p => {
      if (p.isExtra) extraPatients.push(p);
      else patientByBed.set(p.bed, p);
    });

    for (let i = 1; i <= unit.capacity; i++) {
      const bedNum = `${i}`;
      const patient = patientByBed.get(bedNum);
      const bedLabel = unit.bedNames?.[i - 1] || `L-${bedNum}`;
      rows.push({ bed: bedNum, bedLabel, patient, isExtra: false, unitName: unit.name });
    }
    extraPatients.forEach(p => rows.push({ bed: p.bed, bedLabel: p.bed, patient: p, isExtra: true, unitName: unit.name }));
  } else {
    const unitMap = new Map<string, HospitalUnit>();
    units?.forEach(u => unitMap.set(u.id, u));

    patients.forEach(p => {
      const u = unitMap.get(p.unitId);
      const bedLabel = u?.bedNames?.[parseInt(p.bed) - 1] || `L-${p.bed}`;
      rows.push({ bed: p.bed, bedLabel, patient: p, isExtra: p.isExtra, unitName: u?.name || 'SETOR N/A' });
    });
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none animate-in slide-in-from-bottom-4 duration-700">
      <div className="overflow-x-auto print:overflow-visible no-scrollbar">
        <table id="printable-table" className="w-full text-left border-collapse min-w-[1300px] print:min-w-0 print:table-auto">
          <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest print:bg-gray-100 print:text-black">
            <tr>
              <th className="p-6 border-r border-slate-800 w-[140px] print:p-2 print:border-black">Leito / Setor</th>
              <th className="p-6 border-r border-slate-800 min-w-[280px] print:p-2 print:border-black">Identificação</th>
              <th className="p-6 border-r border-slate-800 w-[150px] print:p-2 print:border-black">Permanência</th>
              <th className="p-6 border-r border-slate-800 min-w-[250px] print:p-2 print:border-black">Diagnóstico</th>
              <th className="p-6 border-r border-slate-800 min-w-[250px] print:p-2 print:border-black">Plano / Pendências</th>
              <th className="p-6 text-center w-[120px] print:p-2 print:border-black">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 print:divide-gray-400">
            {rows.map(({ bed, bedLabel, patient, isExtra, unitName }, idx) => {
              if (!patient) {
                return (
                  <tr key={`vago-${bed}-${idx}`} className="bg-slate-50/40 hover:bg-indigo-50/50 transition-colors print:hidden">
                    <td 
                      className="p-6 border-r border-slate-100 text-center cursor-pointer"
                      onClick={() => onActionClick?.({ unitId: unit?.id || '', bed })}
                    >
                       <span className="text-sm font-black text-slate-400 line-clamp-1">{bedLabel}</span>
                       <p className="text-[7px] font-bold text-slate-300 uppercase mt-1">{unitName}</p>
                    </td>
                    <td colSpan={5} className="p-6 text-center">
                       <button onClick={() => onNewAtBed?.(bed)} className="flex items-center gap-3 mx-auto px-8 py-3 border-2 border-dashed rounded-2xl text-slate-400 font-black uppercase text-[10px] hover:bg-white hover:border-indigo-400 transition-all">
                         <UserPlus size={18} /> Leito Disponível
                       </button>
                    </td>
                  </tr>
                );
              }

              const priority = getAutoPriority(patient.entryDateHospital, now);
              const stayGlobal = calculateStay(patient.entryDateHospital, now);
              const stayLocal = calculateStay(patient.admissionDate, now);
              const isBlocked = patient.status === PatientStatus.BLOCKED;
              const isIsolation = patient.status === PatientStatus.ISOLATION || (patient.isolationType && patient.isolationType !== IsolationType.NONE);

              return (
                <tr key={patient.id} className={`hover:bg-indigo-50/50 transition-all group ${isBlocked ? 'bg-red-50/20' : ''} ${isIsolation ? 'bg-red-50/40 border-l-4 border-l-red-600' : ''} print:bg-transparent print:border-black`}>
                  <td 
                    onClick={() => onActionClick?.({ unitId: patient.unitId, bed: patient.bed, patient })} 
                    className="p-6 border-r border-slate-100 text-center print:p-2 print:border-black cursor-pointer"
                  >
                    <div className={`p-2 rounded-xl mx-auto mb-1 w-fit ${isExtra ? 'bg-purple-100 text-purple-600' : isBlocked ? 'bg-red-100 text-red-600' : isIsolation ? 'bg-red-600 text-white animate-pulse' : 'bg-indigo-100 text-indigo-600'} print:bg-transparent print:text-black`}>
                      {isIsolation ? <Biohazard size={18} /> : <Bed size={18} />}
                    </div>
                    <span className="text-sm font-black text-slate-900 line-clamp-1 print:text-[10px]">{bedLabel}</span>
                    <p className="text-[7px] font-black text-slate-400 uppercase mt-1 print:text-[7px]">{unitName}</p>
                  </td>
                  <td className="p-6 border-r border-slate-100 print:p-2 print:border-black relative">
                    <div className="flex flex-col space-y-1 cursor-pointer" onClick={() => onEdit(patient)}>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 uppercase text-xs print:text-[10px]">{patient.name}</span>
                        {isIsolation && <span className="px-2 py-0.5 bg-red-600 text-white text-[7px] font-black rounded-full uppercase">Isolamento</span>}
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 print:text-[7px]">SES: {patient.sesId} | {patient.gender}/{patient.age}a</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase print:text-[7px]">Origem: {patient.origin}</span>
                      {patient.etiologicalAgent && <span className="text-[8px] font-black text-red-600 uppercase flex items-center gap-1 mt-1"><ShieldAlert size={10}/> Agente: {patient.etiologicalAgent}</span>}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onHistoryClick?.(patient.id); }}
                        className="absolute bottom-2 right-2 p-2 bg-indigo-50 text-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white print:hidden shadow-sm"
                        title="Ver Dossiê/Linha do Tempo"
                    >
                        <History size={14} />
                    </button>
                  </td>
                  <td onClick={() => onEdit(patient)} className="p-6 border-r border-slate-100 print:p-2 print:border-black cursor-pointer">
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 print:text-[7px]"><span>Hospital:</span> <span className={`px-2 py-0.5 rounded font-bold ${stayGlobal.days >= 10 ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{formatStay(stayGlobal)}</span></div>
                      <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 print:text-[7px]"><span>Setor:</span> <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold">{formatStay(stayLocal)}</span></div>
                      
                      {/* Bloco de Previsibilidade de Alta em Evidência */}
                      {(() => {
                        const predStatus = getDischargePredictionStatus(patient, now);
                        if (!predStatus.hasPrediction) {
                          return !isBlocked ? (
                            <div className="mt-2.5 pt-2 border-t border-dashed border-indigo-200">
                              <span className="text-[8px] font-black text-indigo-500 hover:text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-lg border border-indigo-100 uppercase flex items-center justify-center gap-1 transition-colors">
                                <Calendar size={11} className="text-indigo-500" />
                                + Definir Previsão Alta (PTS)
                              </span>
                            </div>
                          ) : null;
                        }

                        let badgeStyle = 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
                        let label = `NO PRAZO (em ${predStatus.daysRemaining}d)`;
                        let icon = <CheckCircle size={12} className="text-white shrink-0" />;

                        if (predStatus.status === 'DELAYED') {
                          badgeStyle = 'bg-red-600 text-white border-red-700 shadow-md animate-pulse';
                          label = `ATRASADA (+${Math.abs(predStatus.daysRemaining)}d)`;
                          icon = <AlertTriangle size={12} className="text-white shrink-0" />;
                        } else if (predStatus.status === 'TODAY') {
                          badgeStyle = 'bg-amber-400 text-slate-900 border-amber-500 shadow-md font-black animate-pulse';
                          label = 'ALTA PREVISTA: HOJE';
                          icon = <Clock size={12} className="text-slate-900 shrink-0" />;
                        } else if (predStatus.status === 'APPROACHING') {
                          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-sm font-black';
                          label = predStatus.daysRemaining === 1 ? 'ALTA AMANHÃ (1d)' : `ALTA PRÓXIMA (em ${predStatus.daysRemaining}d)`;
                          icon = <Calendar size={12} className="text-white shrink-0" />;
                        }

                        return (
                          <div className="mt-2.5 pt-2 border-t border-slate-200">
                            <div className={`p-2 rounded-xl border text-[9px] font-black flex flex-col gap-1 ${badgeStyle}`}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1.5 uppercase tracking-tight">
                                  {icon}
                                  {label}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[8px] font-bold opacity-95">
                                <span>Meta: {predStatus.formattedDate}</span>
                              </div>
                            </div>
                            {predStatus.isRecalculated && (
                              <div className="mt-1.5 p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-[8px] font-bold">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1 font-black uppercase text-purple-800">
                                    <RefreshCw size={9} /> PTS Recalculado ({predStatus.totalPredictionsCount}ª prev)
                                  </span>
                                  {predStatus.previousDate && (
                                    <span className="line-through text-purple-400 font-medium">
                                      Ant: {new Date(predStatus.previousDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                </div>
                                {predStatus.lastReason && (
                                  <p className="text-[8px] text-purple-700 font-medium mt-0.5 truncate" title={predStatus.lastReason}>
                                    Motivo: {predStatus.lastReason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td onClick={() => onEdit(patient)} className="p-6 border-r border-slate-100 print:p-2 print:border-black cursor-pointer">
                    <span className="text-[10px] font-bold text-slate-700 uppercase leading-tight line-clamp-4 whitespace-pre-wrap print:text-[9px] print:line-clamp-none">{patient.diagnosis}</span>
                  </td>
                  <td onClick={() => onEdit(patient)} className="p-6 border-r border-slate-100 print:p-2 print:border-black cursor-pointer">
                    <div className="space-y-1">
                      {patient.pendingTasks?.map(task => {
                        const isExpired = task.expiresAt && new Date(task.expiresAt).getTime() < now;
                        return (
                          <div key={task.id} className={`flex items-start gap-2 p-1 border rounded-lg border ${isExpired ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'} print:bg-transparent print:border-none print:p-0`}>
                            {!isExpired && <Clock size={10} className="text-slate-400 mt-1 print:hidden" />}
                            {isExpired && <AlertTriangle size={10} className="text-red-600 mt-1 print:hidden" />}
                            <div className="flex flex-col">
                               <span className={`text-[8px] font-black uppercase ${isExpired ? 'text-red-700' : 'text-slate-700'} print:text-[8px]`}>• {task.description}</span>
                               <span className="text-[7px] font-bold text-slate-400 uppercase print:text-[7px]">
                                  {task.expiresAt ? (isExpired ? 'VENCIDO' : `Exp: ${new Date(task.expiresAt).toLocaleDateString('pt-BR')}`) : getElapsedTime(task.createdAt)}
                               </span>
                            </div>
                          </div>
                        );
                      })}
                      {patient.pendingTasks?.length === 0 && <span className="text-[8px] italic text-slate-300 print:hidden">Sem pendências</span>}
                    </div>
                  </td>
                  <td onClick={() => onEdit(patient)} className="p-6 text-center print:p-2 print:border-black cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      {!isBlocked && <div className={`w-6 h-6 rounded-full border-2 border-white shadow-md print:hidden ${getPriorityColor(priority)}`}></div>}
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase print:text-[7px] ${isIsolation ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500'}`}>{patient.status}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatientTable;
