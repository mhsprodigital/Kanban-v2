
import React, { useMemo } from 'react';
import { Patient, HospitalUnit, PatientPriority, PatientStatus, Collaborator } from '../../types';
import PatientTable from '../PatientTable';
import { Plus, Printer, Layers } from 'lucide-react';
import { getAutoPriority, calculateStay } from '../../utils/calculations';

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
      list = list.filter(p => p.name.toLowerCase().includes(lower) || p.sesId.includes(searchTerm));
    }
    return list;
  }, [patients, currentUnitId, activeFilter, searchTerm]);

  const handlePrintHandover = () => {
    const unitName = currentUnitId === 'global' ? 'Hospital Geral HRT' : currentUnit?.name;
    const dateStr = new Date().toLocaleString('pt-BR');
    
    const sortedPatients = [...filteredPatients].sort((a, b) => parseInt(a.bed) - parseInt(b.bed));

    let html = `
      <html>
        <head>
          <title>Handover - ${unitName}</title>
          <style>
            @page { size: landscape; margin: 0.5cm; }
            body { font-family: 'Inter', sans-serif; font-size: 8px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 4px; text-align: left; }
            th { background: #f1f5f9; font-weight: 900; text-transform: uppercase; font-size: 7px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin:0; font-size: 14px;">PASSAGEM DE PLANTÃO - HRT</h1>
            <p style="margin:0; font-size: 8px;">Unidade: ${unitName} | Emissão: ${dateStr} | Por: ${currentUser.name}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">Leito</th>
                <th style="width: 140px;">Paciente / SES</th>
                <th style="width: 60px;">Estadia</th>
                <th style="width: 180px;">Diagnóstico</th>
                <th>Pendências</th>
              </tr>
            </thead>
            <tbody>
    `;

    sortedPatients.forEach(p => {
      if (p.status === PatientStatus.BLOCKED) return;
      const stay = calculateStay(p.entryDateHospital);
      const bedLabel = currentUnit?.bedNames?.[parseInt(p.bed) - 1] || `L-${p.bed}`;
      html += `
        <tr>
          <td style="font-weight:900;">${bedLabel}</td>
          <td><b>${p.name}</b><br>${p.sesId} | ${p.gender}/${p.age}a</td>
          <td>${stay.days}d ${stay.hours}h</td>
          <td>${p.diagnosis}</td>
          <td>${p.pendingTasks.map(t => `• ${t.description}`).join('<br>')}</td>
        </tr>
      `;
    });

    html += `</tbody></table></body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  return (
    <div className="space-y-8">
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
