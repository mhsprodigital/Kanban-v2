
import React, { useMemo, useState } from 'react';
import { PatientMovement, MovementType } from '../../types';
import { Download, Calendar, Search, Filter, Target, ArrowRight } from 'lucide-react';

interface Props {
  movements: PatientMovement[];
  onHistoryClick: (id: string) => void;
}

const AuditView: React.FC<Props> = ({ movements, onHistoryClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filtered = useMemo(() => {
    return movements.filter(m => {
      const term = (searchTerm || '').toLowerCase();
      const matchSearch = searchTerm === '' || 
        (m.patientName || '').toLowerCase().includes(term) ||
        (m.bed || '').toLowerCase().includes(term) ||
        (m.type || '').toLowerCase().includes(term) ||
        (m.details || '').toLowerCase().includes(term) ||
        (m.collaborator?.name || '').toLowerCase().includes(term);

      const matchType = selectedType === 'ALL' || m.type === selectedType;
      const matchStart = !dateRange.start || new Date(m.date) >= new Date(dateRange.start + 'T00:00:00');
      const matchEnd = !dateRange.end || new Date(m.date) <= new Date(dateRange.end + 'T23:59:59');
      
      return matchSearch && matchType && matchStart && matchEnd;
    });
  }, [movements, searchTerm, dateRange, selectedType]);

  const handleExportCSV = () => {
    const headers = ['Data e Hora', 'Evento', 'Paciente', 'Leito', 'De (Origem)', 'Para (Destino)', 'Detalhes / Justificativa PTS', 'Responsável'];
    const rows = filtered.map(m => [
      `"${new Date(m.date).toLocaleString('pt-BR')}"`,
      `"${m.type}"`,
      `"${m.patientName}"`,
      `"L-${m.bed}"`,
      `"${m.fromUnit || '---'}"`,
      `"${m.toUnit || '---'}"`,
      `"${(m.details || '').replace(/"/g, '""')}"`,
      `"${m.collaborator?.name || 'Sistema'}"`
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-[3rem] shadow-xl border gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Movimentações & Auditoria</h3>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Rastreabilidade completa de admissões, transferências, altas e revisões do PTS</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Pesquisar paciente, leito, PTS..." 
              className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-56" 
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Filter size={14} className="text-slate-400 ml-1" />
            <select 
              value={selectedType} 
              onChange={e => setSelectedType(e.target.value)}
              className="bg-transparent text-[11px] font-black outline-none cursor-pointer uppercase text-slate-700"
            >
              <option value="ALL">Todos os Eventos</option>
              <option value={MovementType.PTS_PREDICTION}>Previsibilidade de Alta (PTS)</option>
              <option value={MovementType.ADMISSION}>Admissão</option>
              <option value={MovementType.DISCHARGE}>Alta</option>
              <option value={MovementType.DECEASED}>Óbito</option>
              <option value={MovementType.TRANSFER}>Transferência Interna</option>
              <option value={MovementType.EXTERNAL_TRANSFER}>Transferência Externa</option>
              <option value={MovementType.BLOCKAGE}>Bloqueio de Leito</option>
              <option value={MovementType.UNBLOCKAGE}>Desbloqueio de Leito</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-transparent text-[10px] font-black outline-none" />
            <span className="text-slate-300">➔</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-transparent text-[10px] font-black outline-none" />
          </div>

          <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center shadow-lg hover:bg-emerald-700 transition-all">
            <Download size={16} className="mr-2" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-6 w-44">Cronologia</th>
                <th className="p-6 w-48">Evento</th>
                <th className="p-6 w-56">Paciente / Leito</th>
                <th className="p-6">Detalhes / Justificativa PTS</th>
                <th className="p-6 w-48">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-xs font-bold text-slate-400 uppercase">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map(m => {
                  const isPTS = m.type === MovementType.PTS_PREDICTION;
                  return (
                    <tr key={m.id} onClick={() => onHistoryClick(m.patientId)} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                      <td className="p-6 text-xs font-bold text-slate-500 whitespace-nowrap">
                        {new Date(m.date).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-6 whitespace-nowrap">
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-1.5 ${
                          isPTS ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          m.type === MovementType.DISCHARGE ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          m.type === MovementType.DECEASED ? 'bg-slate-200 text-slate-800' :
                          m.type === MovementType.ADMISSION ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          {isPTS && <Target size={12} className="text-purple-700" />}
                          {m.type}
                        </span>
                      </td>
                      <td className="p-6">
                        <p className="font-black text-slate-900 uppercase text-xs group-hover:text-indigo-600 transition-colors">{m.patientName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Leito {m.bed}</p>
                      </td>
                      <td className="p-6 text-xs">
                        {m.details ? (
                          <div className={`p-3 rounded-2xl font-bold leading-relaxed ${isPTS ? 'bg-purple-50/80 border border-purple-100 text-purple-900' : 'bg-slate-50 text-slate-700'}`}>
                            {m.details}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 uppercase">
                            {m.fromUnit || 'Início'} ➔ {m.toUnit || 'Saída'}
                          </span>
                        )}
                      </td>
                      <td className="p-6 text-[10px] font-bold text-slate-600 uppercase whitespace-nowrap">
                        {m.collaborator?.name || 'Sistema'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditView;
