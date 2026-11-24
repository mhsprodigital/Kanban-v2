
import React, { useState } from 'react';
import { HospitalUnit, Patient, PatientStatus, Collaborator, AccessLog, UserInvitation, PatientMovement } from '../../types';
import UnitManager from '../UnitManager';
import { Bed, History, XCircle, ShieldCheck, Users, Shield, Clock, Check, X, Search, Download, Edit3, Trash2, Mail, Database, FileSpreadsheet, FileText, BarChart3, Activity, Loader2, Calendar } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { exportDatabase, ExportDatasetKey } from '../../utils/exportDatabase';

interface Props {
  units: HospitalUnit[];
  patients: Patient[];
  movements: PatientMovement[];
  users: Collaborator[];
  invitations: UserInvitation[];
  accessLogs: AccessLog[];
  dashboardDates: { start: string; end: string };
  onAddUnit: (u: any) => void;
  onUpdateUnit: (u: HospitalUnit) => void;
  onDeleteUnit: (id: string) => void;
  onToggleBlock: (uId: string, bed: string) => void;
  onActionClick: (info: any) => void;
  onAddInvitation: (u: Partial<UserInvitation>) => void;
  onUpdateInvitation: (u: UserInvitation) => void;
  onDeleteInvitation: (id: string) => void;
}

const SettingsView: React.FC<Props> = ({ 
  units, patients, movements, users, invitations, accessLogs, dashboardDates, onAddUnit, onUpdateUnit, onDeleteUnit, onToggleBlock, onActionClick, onAddInvitation, onUpdateInvitation, onDeleteInvitation
}) => {
  const [activeTab, setActiveTab] = useState<'units' | 'users' | 'logs' | 'backup'>('units');
  const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name));
  
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);
  const [editingInvitation, setEditingInvitation] = useState<(Partial<UserInvitation> & { id?: string }) | null>(null);
  const [invitationToDelete, setInvitationToDelete] = useState<string | null>(null);

  const [logSearch, setLogSearch] = useState('');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');

  const [exportStartDate, setExportStartDate] = useState(dashboardDates?.start || new Date().toISOString().slice(0, 10));
  const [exportEndDate, setExportEndDate] = useState(dashboardDates?.end || new Date().toISOString().slice(0, 10));
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => localStorage.getItem('hrt_last_backup_at'));

  const handleRunExport = async (dataset: ExportDatasetKey, format: 'xlsx' | 'csv') => {
    const opKey = `${dataset}_${format}`;
    setExportingKey(opKey);
    try {
      await exportDatabase({
        dataset,
        format,
        startDate: exportStartDate,
        endDate: exportEndDate,
        fallbackData: {
          units,
          patients,
          movements,
          invitations,
          users,
          accessLogs,
        },
      });
      if (dataset === 'all') {
        const nowStr = new Date().toLocaleString('pt-BR');
        localStorage.setItem('hrt_last_backup_at', nowStr);
        setLastBackupAt(nowStr);
      }
      toast.success(
        dataset === 'all'
          ? 'Backup completo (.XLSX) exportado com sucesso!'
          : `Relatório exportado em ${format.toUpperCase()} com sucesso!`
      );
    } catch (error) {
      console.error('Erro ao exportar base de dados:', error);
      toast.error('Erro ao gerar arquivo de exportação.');
    } finally {
      setExportingKey(null);
    }
  };

  const filteredLogs = accessLogs.filter(log => {
    const term = (logSearch || '').toLowerCase();
    const matchesSearch = logSearch === '' || 
      (log.name || '').toLowerCase().includes(term) || 
      (log.email || '').toLowerCase().includes(term) || 
      (log.category || '').toLowerCase().includes(term);
    
    let matchesDate = true;
    if (logStartDate || logEndDate) {
      const logDate = new Date(log.timestamp);
      logDate.setHours(0, 0, 0, 0);
      
      if (logStartDate) {
        const start = new Date(logStartDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) matchesDate = false;
      }
      if (logEndDate) {
        const end = new Date(logEndDate);
        end.setHours(0, 0, 0, 0);
        if (logDate > end) matchesDate = false;
      }
    }
    return matchesSearch && matchesDate;
  });

  const exportLogsToCSV = () => {
    const headers = ['Data/Hora', 'Usuário', 'Email', 'Categoria'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString('pt-BR'),
      log.name,
      log.email,
      log.category
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `logs_acesso_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-4">
        <button 
          onClick={() => setActiveTab('units')}
          className={`px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all ${activeTab === 'units' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          Setores e Leitos
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`relative px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          Usuários
          {invitations.some(inv => inv.resetRequested) && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          Logs de Acesso
        </button>
        <button 
          onClick={() => setActiveTab('backup')}
          className={`px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 ${activeTab === 'backup' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          <Database size={16} />
          Backup & Exportação
        </button>
      </div>

      {activeTab === 'units' && (
        <div className="space-y-12">
          <UnitManager units={units} onAdd={onAddUnit} onUpdate={onUpdateUnit} onDelete={onDeleteUnit} />
          
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
            <h3 className="text-3xl font-black text-slate-900 uppercase mb-8">Gestão de Bloqueios e Recursos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {sortedUnits.map(u => (
                <div key={u.id} className="p-8 bg-slate-50 border-2 rounded-[2.5rem] hover:border-indigo-200 transition-all">
                  <p className="font-black text-slate-800 text-lg uppercase mb-8 border-b pb-3 flex justify-between items-center">
                    <span>{u.name}</span>
                    <span className="text-[10px] bg-white px-3 py-1 rounded-full border text-slate-400">Cap: {u.capacity}</span>
                  </p>
                  <div className="grid grid-cols-5 gap-4">
                    {Array.from({length: u.capacity}).map((_, i) => {
                      const bedNum = String(i + 1);
                      const customLabel = u.bedNames?.[i] || bedNum;
                      const patient = patients.find(p => p.unitId === u.id && p.bed === bedNum && ![PatientStatus.DISCHARGED, PatientStatus.DECEASED, PatientStatus.EVASION, PatientStatus.TRANSFERRED].includes(p.status));
                      
                      return (
                        <button 
                          key={bedNum} 
                          onClick={() => onActionClick({ unitId: u.id, bed: bedNum, patient })}
                          className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all active:scale-95 ${patient?.status === PatientStatus.BLOCKED ? 'bg-red-600 border-red-700 text-white' : patient ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:text-emerald-800'}`}
                        >
                          <span className="text-[9px] font-black line-clamp-1 px-1">{customLabel}</span>
                          {patient?.status === PatientStatus.BLOCKED ? <XCircle size={14} className="mt-1" /> : patient ? <History size={14} className="mt-1" /> : <ShieldCheck size={14} className="mt-1 opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Users className="mr-4 text-indigo-600" size={32} />
              <h3 className="text-3xl font-black text-slate-900 uppercase">Gestão de Usuários</h3>
            </div>
            <button 
              onClick={() => { setEditingInvitation(null); setIsInvitationModalOpen(true); }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-md hover:bg-indigo-700 transition-colors"
            >
              Novo Usuário
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Nome / Username</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Setor / Cargo</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Papel</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{inv.name}</p>
                      <p className="text-xs text-slate-500">@{inv.username}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-bold text-slate-700">{inv.setor || '-'}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{inv.cargo || '-'}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        inv.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        inv.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                        inv.status === 'blocked' ? 'bg-red-100 text-red-700' : 
                        inv.resetRequested ? 'bg-amber-100 text-amber-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {inv.resetRequested ? 'Reset Solicitado' : inv.status === 'active' ? 'Ativo' : inv.status === 'blocked' ? 'Bloqueado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {inv.resetRequested && (
                          <button onClick={async () => {
                            try {
                              if (inv.uid) {
                                await deleteDoc(doc(db, 'users', inv.uid));
                              }
                              const newAuthEmail = `${inv.username}_${Date.now()}@hrt.local`;
                              onUpdateInvitation({ 
                                ...inv, 
                                authEmail: newAuthEmail,
                                uid: null,
                                status: 'pending', 
                                resetRequested: false 
                              });
                              toast.success("Reset aprovado. O usuário pode recadastrar a senha.");
                            } catch (error) {
                              console.error(error);
                              toast.error("Erro ao aprovar reset.");
                            }
                          }} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors" title="Aprovar Reset (Voltar para Pendente)">
                            <Check size={18} />
                          </button>
                        )}
                        <button onClick={() => { setEditingInvitation(inv); setIsInvitationModalOpen(true); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors" title="Editar">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => setInvitationToDelete(inv.id!)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors" title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invitations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">Nenhum usuário encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center">
              <Clock className="mr-4 text-indigo-600" size={32} />
              <h3 className="text-3xl font-black text-slate-900 uppercase">Logs de Acesso</h3>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome, email ou categoria..." 
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={logStartDate}
                  onChange={(e) => setLogStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400 font-bold text-xs">até</span>
                <input 
                  type="date" 
                  value={logEndDate}
                  onChange={(e) => setLogEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <button 
                onClick={exportLogsToCSV}
                className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-2xl font-black uppercase text-xs hover:bg-emerald-100 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Data / Hora</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Usuário</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700 text-sm">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-4 font-bold text-slate-900">{log.name}</td>
                    <td className="p-4 text-slate-500 text-sm">{log.email}</td>
                    <td className="p-4 font-bold text-indigo-600 text-sm uppercase">{log.category}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">Nenhum log de acesso encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {activeTab === 'backup' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Card Principal: Backup Geral em Excel (.XLSX) */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 md:p-12 rounded-[3rem] shadow-2xl text-white border border-indigo-500/20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                  <Database size={12} /> Backup Programado da Base de Dados
                </div>
                <h3 className="text-3xl font-black tracking-tight uppercase">
                  Exportar Toda a Base de Dados em Excel
                </h3>
                <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
                  Gera uma planilha Excel (<strong className="text-white">.XLSX</strong>) consolidada com todas as coleções completas diretamente do banco de dados em abas separadas: Quadro Ativo, Setores e Leitos, Gestão de Indicadores, Histórico de Movimentações & Auditoria, Usuários, Logs de Acesso e Base Completa de Pacientes.
                </p>
                {lastBackupAt && (
                  <p className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 pt-1">
                    <Clock size={14} /> Último backup completo realizado em: {lastBackupAt}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <button
                  onClick={() => handleRunExport('all', 'xlsx')}
                  disabled={exportingKey !== null}
                  className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 rounded-2xl font-black uppercase text-xs tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  {exportingKey === 'all_xlsx' ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={20} />
                  )}
                  {exportingKey === 'all_xlsx' ? 'Gerando Backup...' : 'Baixar Base Completa (.XLSX)'}
                </button>
              </div>
            </div>
          </div>

          {/* Filtro de Período para Gestão de Indicadores */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-lg border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                Período de Referência — Gestão de Indicadores
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Define o intervalo considerado no cálculo de altas, óbitos, transferências e assertividade PTS na planilha de indicadores.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-slate-400">Início</span>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 outline-none"
                />
              </div>
              <span className="text-slate-300 font-bold">➔</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-slate-400">Fim</span>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Exportações Individuais por Módulo (XLSX ou CSV) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                key: 'units' as ExportDatasetKey,
                title: 'Setores e Leitos',
                desc: 'Relação completa de unidades, capacidade, identificação dos leitos, ocupação e bloqueios.',
                badge: `${units.length} setores • ${units.reduce((acc, u) => acc + (u.capacity || 0), 0)} leitos`,
                icon: Bed,
                iconBg: 'bg-indigo-100 text-indigo-600',
              },
              {
                key: 'users' as ExportDatasetKey,
                title: 'Usuários',
                desc: 'Cadastro completo de usuários, convites, setores, cargos, papéis (admin/usuário) e status.',
                badge: `${Math.max(invitations.length, users.length)} registros`,
                icon: Users,
                iconBg: 'bg-blue-100 text-blue-600',
              },
              {
                key: 'logs' as ExportDatasetKey,
                title: 'Logs de Acesso',
                desc: 'Registro completo de autenticações e entradas no sistema com data, hora, e-mail e perfil.',
                badge: `${accessLogs.length}+ registros recentes`,
                icon: Clock,
                iconBg: 'bg-amber-100 text-amber-600',
              },
              {
                key: 'movements' as ExportDatasetKey,
                title: 'Histórico de Movimentações & Auditoria',
                desc: 'Rastreabilidade completa de admissões, transferências, altas, óbitos, bloqueios e revisões PTS.',
                badge: `${movements.length}+ eventos`,
                icon: History,
                iconBg: 'bg-purple-100 text-purple-600',
              },
              {
                key: 'active_board' as ExportDatasetKey,
                title: 'Quadro Ativo',
                desc: 'Censo completo dos leitos ocupados e bloqueados, diagnósticos, isolamentos, PTS e pendências.',
                badge: `${patients.length} pacientes/bloqueios ativos`,
                icon: Activity,
                iconBg: 'bg-emerald-100 text-emerald-600',
              },
              {
                key: 'indicators' as ExportDatasetKey,
                title: 'Gestão de Indicadores',
                desc: 'Indicadores consolidados do Hospital Geral e por setor: ocupação, permanência, Kanban e assertividade PTS.',
                badge: `Hospital Geral + ${units.length} setores`,
                icon: BarChart3,
                iconBg: 'bg-rose-100 text-rose-600',
              },
            ].map((item) => {
              const IconComp = item.icon;
              const isXlsxLoading = exportingKey === `${item.key}_xlsx`;
              const isCsvLoading = exportingKey === `${item.key}_csv`;

              return (
                <div
                  key={item.key}
                  className="bg-white p-7 rounded-[2.5rem] shadow-lg border border-slate-100 flex flex-col justify-between gap-6 hover:border-indigo-200 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                        <IconComp size={24} />
                      </div>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">
                        {item.badge}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleRunExport(item.key, 'xlsx')}
                      disabled={exportingKey !== null}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                    >
                      {isXlsxLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                      XLSX
                    </button>
                    <button
                      onClick={() => handleRunExport(item.key, 'csv')}
                      disabled={exportingKey !== null}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      {isCsvLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      CSV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isInvitationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-6 uppercase">
              {editingInvitation ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const username = (editingInvitation?.username || (formData.get('username') as string) || '').toLowerCase().trim();
              if (!username) {
                toast.error("Nome de usuário é obrigatório.");
                return;
              }
              const invData = {
                username,
                name: ((formData.get('name') as string) || '').trim() || username,
                authEmail: editingInvitation?.authEmail || `${username}@hrt.local`,
                role: (formData.get('role') as 'admin' | 'user') || editingInvitation?.role || 'user',
                status: (formData.get('status') as 'active' | 'pending' | 'blocked') || editingInvitation?.status || 'pending',
                setor: ((formData.get('setor') as string) || '').trim(),
                cargo: ((formData.get('cargo') as string) || '').trim(),
              };
              if (editingInvitation?.id) {
                onUpdateInvitation({ ...editingInvitation, ...invData } as UserInvitation);
              } else {
                onAddInvitation({ ...invData, status: 'pending' } as Partial<UserInvitation>);
              }
              setIsInvitationModalOpen(false);
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Username</label>
                <input 
                  name="username" 
                  defaultValue={editingInvitation?.username} 
                  required 
                  readOnly={!!editingInvitation} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 read-only:bg-slate-100 read-only:cursor-not-allowed text-slate-700" 
                  placeholder="ex: joao.silva" 
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Nome Completo</label>
                <input name="name" defaultValue={editingInvitation?.name} required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Setor</label>
                  <input name="setor" defaultValue={editingInvitation?.setor} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" placeholder="ex: UTI (Opcional)" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Cargo</label>
                  <input name="cargo" defaultValue={editingInvitation?.cargo} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" placeholder="ex: Enfermeiro (Opcional)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Papel</label>
                  <select name="role" defaultValue={editingInvitation?.role || 'user'} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Status</label>
                  <select name="status" defaultValue={editingInvitation?.status || 'pending'} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
                    <option value="pending">Pendente</option>
                    <option value="active">Ativo</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsInvitationModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-md hover:bg-indigo-700 transition-colors">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {invitationToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Convite?</h3>
            <p className="text-sm text-slate-500 mb-8">Esta ação não pode ser desfeita. O usuário não poderá mais criar sua conta.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setInvitationToDelete(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={() => { onDeleteInvitation(invitationToDelete); setInvitationToDelete(null); }} className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-md hover:bg-red-700 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsView;
