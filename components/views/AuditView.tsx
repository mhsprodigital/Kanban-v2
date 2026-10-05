
import React, { useMemo, useState } from 'react';
import { PatientMovement, MovementType } from '../../types';
import { Download, Calendar, Search } from 'lucide-react';

interface Props {
  movements: PatientMovement[];
  onHistoryClick: (id: string) => void;
}

const AuditView: React.FC<Props> = ({ movements, onHistoryClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const filtered = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = (m.patientName || '').toLowerCase().includes((searchTerm || '').toLowerCase());
      const matchStart = !dateRange.start || new Date(m.date) >= new Date(dateRange.start + 'T00:00:00');
      const matchEnd = !dateRange.end || new Date(m.date) <= new Date(dateRange.end + 'T23:59:59');
      return matchSearch && matchStart && matchEnd;
    });
  }, [movements, searchTerm, dateRange]);

  const handleExportCSV = () => {
    const headers = ['Data', 'Evento', 'Paciente', 'De', 'Para', 'Leito', 'Responsável'];
    const rows = filtered.map(m => [
      new Date(m.date).toLocaleString('pt-BR'),
      m.type,
      m.patientName,
      m.fromUnit || '---',
      m.toUnit || '---',
      m.bed,
      m.collaborator.name
    ]);
    const content = "\ufeff" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_hrt_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-8 rounded-[3rem] shadow-xl border gap-6">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Movimentações</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Pesquisar..." className="pl-10 pr-4 py-2 bg-slate-50 border rounded-xl text-xs font-bold outline-none" />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-transparent text-[10px] font-black outline-none" />
            <span className="text-slate-300">➔</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-transparent text-[10px] font-black outline-none" />
          </div>
          <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase flex items-center shadow-lg"><Download size={18} className="mr-2" /> Exportar</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
            <tr><th className="p-6">Cronologia</th><th className="p-6">Evento</th><th className="p-6">Paciente</th><th className="p-6">Responsável</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(m => (
              <tr key={m.id} onClick={() => onHistoryClick(m.patientId)} className="hover:bg-slate-50 transition-all cursor-pointer group">
                <td className="p-6 text-xs font-bold text-slate-400">{new Date(m.date).toLocaleString('pt-BR')}</td>
                <td className="p-6 font-black uppercase text-[10px] text-indigo-600">{m.type}</td>
                <td className="p-6">
                  <p className="font-black text-slate-900 uppercase text-xs">{m.patientName}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">L-{m.bed}</p>
                </td>
                <td className="p-6 text-[10px] font-bold text-slate-500 uppercase">{m.collaborator.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditView;
