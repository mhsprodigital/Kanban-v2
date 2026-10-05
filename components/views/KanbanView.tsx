
import React, { useMemo } from 'react';
import { Patient, HospitalUnit, PatientPriority, PatientStatus, Collaborator } from '../../types';
import PatientTable from '../PatientTable';
import { Plus, Printer, Layers } from 'lucide-react';
import { getAutoPriority, calculateStay } from '../../utils/calculations';
import toast from 'react-hot-toast';

interface Props {
  patients: Patient[];
  units: HospitalUnit[];
  currentUnitId: string;
  stats: any;
  searchTerm: string;
  activeFilter: PatientPriority | 'BLOCKED' | null;
  setActiveFilter: (f: PatientPriority | 'BLOCKED' | null) => void;
  onAdmissao: () => void;
  onEdit: (p: Patient) => void;
  onNewAtBed: (bed: string) => void;
  onHistoryClick: (id: string) => void;
  onActionClick?: (info: { unitId: string, bed: string, patient?: Patient }) => void;
  currentUser: Collaborator;
}

const KanbanView: React.FC<Props> = ({ 
  patients, units, currentUnitId, stats, searchTerm, activeFilter, 
  setActiveFilter, onAdmissao, onEdit, onNewAtBed, onHistoryClick, onActionClick, currentUser 
}) => {
  const currentUnit = units.find(u => u.id === currentUnitId);

  const filteredPatients = useMemo(() => {
    let list = patients.filter(p => ![PatientStatus.DISCHARGED, PatientStatus.DECEASED, PatientStatus.EVASION, PatientStatus.TRANSFERRED].includes(p.status));
    if (currentUnitId !== 'global') list = list.filter(p => p.unitId === currentUnitId);
    
    if (activeFilter) {
      if (activeFilter === 'BLOCKED') list = list.filter(p => p.status === PatientStatus.BLOCKED);
      else list = list.filter(p => p.status !== PatientStatus.BLOCKED && getAutoPriority(p.entryDateHospital) === activeFilter);
    }
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(lower) || (p.sesId || '').includes(searchTerm));
    }
    return list;
  }, [patients, currentUnitId, activeFilter, searchTerm]);

  const handlePrintHandover = () => {
    toast.success("Preparando impressão... Se a janela não abrir, pressione Ctrl+P ou Command+P.", { duration: 5000 });
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div className="space-y-8">
      <div className="print:hidden space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border shadow-xl gap-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900">Quadro Ativo</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Layers size={14}/> {currentUnitId === 'global' ? 'Geral' : currentUnit?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <FilterBadge color="red" label="+10d" count={stats.vermelhos} active={activeFilter === PatientPriority.RED} onClick={() => setActiveFilter(activeFilter === PatientPriority.RED ? null : PatientPriority.RED)} />
            <FilterBadge color="yellow" label="5-10d" count={stats.amarelos} active={activeFilter === PatientPriority.YELLOW} onClick={() => setActiveFilter(activeFilter === PatientPriority.YELLOW ? null : PatientPriority.YELLOW)} />
            <FilterBadge color="green" label="<5d" count={stats.verdes} active={activeFilter === PatientPriority.GREEN} onClick={() => setActiveFilter(activeFilter === PatientPriority.GREEN ? null : PatientPriority.GREEN)} />
            <FilterBadge color="slate" label="Block" count={stats.bloqueados} active={activeFilter === 'BLOCKED'} onClick={() => setActiveFilter(activeFilter === 'BLOCKED' ? null : 'BLOCKED')} />
            <div className="flex gap-2 ml-4">
              <button onClick={handlePrintHandover} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center shadow-lg"><Printer size={18} className="mr-2" /> Handover</button>
              <button onClick={onAdmissao} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center shadow-lg"><Plus size={18} className="mr-2" /> Admissão</button>
            </div>
          </div>
        </div>
        <PatientTable 
          patients={filteredPatients} 
          onEdit={onEdit} 
          unit={currentUnit} 
          onNewAtBed={onNewAtBed}
          isGlobalView={currentUnitId === 'global'}
          units={units}
          onHistoryClick={onHistoryClick}
          onActionClick={onActionClick}
        />
      </div>

      {/* Printable Handover Layout */}
      <div className="hidden print:block">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-black uppercase">PASSAGEM DE PLANTÃO - HRT</h1>
          <p className="text-sm mt-2">Unidade: <b>{currentUnitId === 'global' ? 'Hospital Geral HRT' : currentUnit?.name}</b> | Emissão: {new Date().toLocaleString('pt-BR')} | Por: {currentUser.name}</p>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-black p-2 bg-slate-100 font-black uppercase text-left w-16">Leito</th>
              <th className="border border-black p-2 bg-slate-100 font-black uppercase text-left w-48">Paciente / SES</th>
              <th className="border border-black p-2 bg-slate-100 font-black uppercase text-left w-24">Estadia / Prev. Alta</th>
              <th className="border border-black p-2 bg-slate-100 font-black uppercase text-left w-64">Diagnóstico</th>
              <th className="border border-black p-2 bg-slate-100 font-black uppercase text-left">Pendências</th>
            </tr>
          </thead>
          <tbody>
            {[...filteredPatients].sort((a, b) => parseInt(a.bed) - parseInt(b.bed)).map(p => {
              if (p.status === PatientStatus.BLOCKED) return null;
              const stay = calculateStay(p.entryDateHospital);
              const bedLabel = currentUnit?.bedNames?.[parseInt(p.bed) - 1] || `L-${p.bed}`;
              return (
                <tr key={p.id}>
                  <td className="border border-black p-2 font-black text-sm">{bedLabel}</td>
                  <td className="border border-black p-2">
                    <b>{p.name}</b><br/>
                    <span className="text-gray-600">{p.sesId} | {p.gender}/{p.age}a</span>
                    {p.isolationType && p.isolationType !== 'PADRÃO' && (
                      <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 p-1 rounded inline-block">
                        ISOLAMENTO: {p.isolationType} {p.etiologicalAgent ? `(${p.etiologicalAgent})` : ''}
                      </div>
                    )}
                  </td>
                  <td className="border border-black p-2">
                    {stay.days}d {stay.hours}h
                    {p.predictedDischargeDate && (
                      <div className="mt-1 text-[10px] font-bold text-indigo-600">
                        Prev: {new Date(p.predictedDischargeDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </td>
                  <td className="border border-black p-2">{p.diagnosis}</td>
                  <td className="border border-black p-2">
                    <ul className="list-disc pl-4">
                      {p.pendingTasks.map((t, i) => <li key={i}>{t.description}</li>)}
                    </ul>
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

const FilterBadge = ({ color, label, count, active, onClick }: any) => {
  const colors: any = { red: 'border-red-600 text-red-600 bg-red-50', yellow: 'border-yellow-500 text-yellow-600 bg-yellow-50', green: 'border-green-600 text-green-600 bg-green-50', slate: 'border-slate-500 text-slate-500 bg-slate-50' };
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase border-2 flex items-center transition-all ${active ? colors[color] : 'bg-white border-slate-100 text-slate-400'}`}>
      {label}: {count}
    </button>
  );
};

export default KanbanView;
