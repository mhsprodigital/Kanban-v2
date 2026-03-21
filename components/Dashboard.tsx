
import React, { useMemo } from 'react';
import { DashboardStats } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { Bed, Users, TrendingUp, BarChart3, Clock, XCircle, Calendar, ArrowRight } from 'lucide-react';

interface Props {
  stats: DashboardStats;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startDate: string;
  endDate: string;
}

const Dashboard: React.FC<Props> = ({ stats, onStartDateChange, onEndDateChange, startDate, endDate }) => {
  const kpiData = useMemo(() => [
    { name: 'Internação', value: stats.internacao, color: '#3B82F6' },
    { name: 'Estabilização', value: stats.estabilizacao, color: '#EAB308' },
    { name: 'Isolamento', value: stats.isolamento, color: '#EF4444' },
    { name: 'Bloqueados', value: stats.bloqueados, color: '#6B7280' }
  ], [stats]);

  const kanbanData = useMemo(() => [
    { name: 'Red (+10d)', value: stats.vermelhos, color: '#EF4444' },
    { name: 'Yellow (5-10d)', value: stats.amarelos, color: '#EAB308' },
    { name: 'Green (<5d)', value: stats.verdes, color: '#10B981' }
  ], [stats]);

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center space-x-6 hover:shadow-md transition-all">
      <div className={`p-4 rounded-2xl ${colorClass}`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{title}</p>
        <p className="text-3xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
        {subtitle && <p className="text-[9px] font-bold text-indigo-500 uppercase mt-2">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center bg-indigo-900 p-8 rounded-[3rem] shadow-xl text-white gap-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Gestão de Indicadores</h2>
          <p className="text-xs font-bold text-indigo-300 uppercase mt-1">Status Operacional e Censo Diário</p>
        </div>
        <div className="flex items-center gap-4 bg-indigo-800 p-4 rounded-2xl border border-indigo-700">
          <Calendar size={20} className="text-indigo-400" />
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label className="text-[9px] font-black uppercase text-indigo-400">Início</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => onStartDateChange(e.target.value)} 
                className="bg-transparent border-none outline-none font-black text-xs uppercase cursor-pointer" 
              />
            </div>
            <ArrowRight size={14} className="text-indigo-400 mt-2" />
            <div className="flex flex-col">
              <label className="text-[9px] font-black uppercase text-indigo-400">Término</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => onEndDateChange(e.target.value)} 
                className="bg-transparent border-none outline-none font-black text-xs uppercase cursor-pointer" 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Capacidade" value={stats.leitoDia} icon={Bed} colorClass="bg-slate-800" subtitle="Operacional" />
        <StatCard title="Bloqueados" value={stats.bloqueados} icon={XCircle} colorClass="bg-red-600" subtitle="Indisponíveis" />
        <StatCard title="Ocupados" value={stats.ocupados} icon={Users} colorClass="bg-blue-600" subtitle="Demanda" />
        <StatCard title="Ocupação" value={`${stats.taxaOcupacao.toFixed(1)}%`} icon={TrendingUp} colorClass="bg-indigo-600" subtitle="Eficiência" />
        <StatCard title="Permanência Média" value={`${stats.tempoPermanencia.toFixed(1)}d`} icon={Clock} colorClass="bg-teal-600" subtitle="Giro Médio" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
              <BarChart3 className="text-indigo-600" /> Censo de Ocupação HRT
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-4 py-1.5 rounded-full">Auditoria em Tempo Real</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={kpiData} barGap={15}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 800, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={80}>
                  {kpiData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-8 text-center">Giro Kanban HRT</h3>
          <div className="h-48 relative">
             <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie 
                    data={kanbanData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={6} 
                    dataKey="value" 
                    stroke="none"
                  >
                    {kanbanData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900 tabular-nums">{stats.ocupados}</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Ativos</span>
             </div>
          </div>
          <div className="mt-8 space-y-3">
             <div className="flex items-center justify-between p-3 bg-red-50 rounded-2xl border border-red-100 text-red-700">
                <span className="text-[10px] font-black uppercase">+10 Dias</span>
                <span className="text-lg font-black tabular-nums">{stats.vermelhos}</span>
             </div>
             <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-2xl border border-yellow-100 text-yellow-700">
                <span className="text-[10px] font-black uppercase">5-10 Dias</span>
                <span className="text-lg font-black tabular-nums">{stats.amarelos}</span>
             </div>
             <div className="flex items-center justify-between p-3 bg-green-50 rounded-2xl border border-green-100 text-green-700">
                <span className="text-[10px] font-black uppercase">&lt; 5 Dias</span>
                <span className="text-lg font-black tabular-nums">{stats.verdes}</span>
             </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <EventBox title="Altas" count={stats.alta} color="emerald" />
        <EventBox title="Óbitos" count={stats.obito} color="slate" />
        <EventBox title="Evasões" count={stats.evasao} color="orange" />
        <EventBox title="Transf. Externa" count={stats.transferenciaExterna} color="indigo" />
        <EventBox title="Transf. Internas" count={stats.transferenciaInterna} color="teal" />
        <EventBox title="Leitos Extras" count={stats.extras} color="purple" />
      </div>
    </div>
  );
};

const EventBox = ({ title, count, color }: any) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100'
  };
  return (
    <div className={`p-6 rounded-[2rem] border-2 ${colors[color]} flex flex-col items-center justify-center text-center shadow-sm hover:scale-105 transition-all duration-300`}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-2 leading-none">{title}</p>
      <p className="text-3xl font-black tabular-nums leading-none">{count}</p>
    </div>
  );
};

export default Dashboard;
