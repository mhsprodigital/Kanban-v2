import React, { useMemo, useState } from 'react';
import { DashboardStats, Patient, HospitalUnit, PatientMovement, MovementType, PatientStatus, IsolationType } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { 
  Bed, Users, TrendingUp, BarChart3, Clock, XCircle, Calendar, ArrowRight, 
  CalendarCheck, CalendarDays, AlertTriangle, Target, Sparkles, X, Search, 
  ChevronRight, ArrowLeft, History, Stethoscope, ShieldAlert, Biohazard, 
  UserCheck, RefreshCw, CheckCircle2, FileText, Layers, ExternalLink
} from 'lucide-react';
import { calculateStay, getDischargePredictionStatus, getAutoPriority } from '../utils/calculations';

interface Props {
  stats: DashboardStats;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startDate: string;
  endDate: string;
  patients?: Patient[];
  units?: HospitalUnit[];
  movements?: PatientMovement[];
  currentUnitId?: string;
  onEditPatient?: (patient: Patient) => void;
  onOpenDossier?: (patientId: string) => void;
}

interface ActiveIndicatorModal {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  badgeColorClass: string;
  patients: Patient[];
}

const Dashboard: React.FC<Props> = ({ 
  stats, 
  onStartDateChange, 
  onEndDateChange, 
  startDate, 
  endDate,
  patients = [],
  units = [],
  movements = [],
  currentUnitId = 'global',
  onEditPatient,
  onOpenDossier
}) => {
  const [modalIndicator, setModalIndicator] = useState<ActiveIndicatorModal | null>(null);
  const [selectedPatientForJourney, setSelectedPatientForJourney] = useState<Patient | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalUnitFilter, setModalUnitFilter] = useState('ALL');

  const now = Date.now();

  // Pacientes no escopo (Hospital Geral ou Setor Específico)
  const scopedPatients = useMemo(() => {
    if (currentUnitId === 'global') return patients;
    return patients.filter(p => p.unitId === currentUnitId);
  }, [patients, currentUnitId]);

  // Movimentações no escopo e no intervalo de datas
  const scopedMovements = useMemo(() => {
    const startIso = startDate ? new Date(startDate + 'T00:00:00').toISOString() : '';
    const endIso = endDate ? new Date(endDate + 'T23:59:59').toISOString() : '';
    const currentUnitName = units.find(u => u.id === currentUnitId)?.name;

    return movements.filter(m => {
      const matchDate = (!startIso || m.date >= startIso) && (!endIso || m.date <= endIso);
      const matchUnit = currentUnitId === 'global' || m.fromUnit === currentUnitName || m.toUnit === currentUnitName;
      return matchDate && matchUnit;
    });
  }, [movements, startDate, endDate, currentUnitId, units]);

  const kpiData = useMemo(() => [
    { name: 'Internação', value: stats.internacao, color: '#3B82F6', key: 'INTERNACAO' },
    { name: 'Estabilização', value: stats.estabilizacao, color: '#EAB308', key: 'ESTABILIZACAO' },
    { name: 'Isolamento', value: stats.isolamento, color: '#EF4444', key: 'ISOLAMENTO' },
    { name: 'Bloqueados', value: stats.bloqueados, color: '#6B7280', key: 'BLOQUEADOS' }
  ], [stats]);

  const kanbanData = useMemo(() => [
    { name: 'Red (+10d)', value: stats.vermelhos, color: '#EF4444', key: 'KANBAN_RED' },
    { name: 'Yellow (5-10d)', value: stats.amarelos, color: '#EAB308', key: 'KANBAN_YELLOW' },
    { name: 'Green (<5d)', value: stats.verdes, color: '#10B981', key: 'KANBAN_GREEN' }
  ], [stats]);

  // Função para abrir o modal para um indicador específico
  const openIndicator = (
    id: string, 
    title: string, 
    subtitle: string, 
    icon: any, 
    badgeColorClass: string,
    list: Patient[]
  ) => {
    setModalIndicator({
      id,
      title,
      subtitle,
      icon,
      badgeColorClass,
      patients: list
    });
    setSelectedPatientForJourney(null);
    setModalSearchTerm('');
    setModalUnitFilter('ALL');
  };

  // Resolução de listas de pacientes para cada indicador
  const getActivePatients = () => scopedPatients.filter(p => 
    [PatientStatus.ADMITTED, PatientStatus.STABILIZATION, PatientStatus.ISOLATION].includes(p.status)
  );

  const getBlockedPatients = () => scopedPatients.filter(p => p.status === PatientStatus.BLOCKED);

  const getTodayPredictionPatients = () => {
    return getActivePatients().filter(p => {
      if (!p.predictedDischargeDate) return false;
      const status = getDischargePredictionStatus(p, now);
      return status.status === 'TODAY';
    });
  };

  const getUpcomingPredictionPatients = () => {
    return getActivePatients().filter(p => {
      if (!p.predictedDischargeDate) return false;
      const status = getDischargePredictionStatus(p, now);
      return status.daysRemaining > 0;
    });
  };

  const getDelayedPredictionPatients = () => {
    return getActivePatients().filter(p => {
      if (!p.predictedDischargeDate) return false;
      const status = getDischargePredictionStatus(p, now);
      return status.status === 'DELAYED';
    });
  };

  const getAssertiveDischargePatients = () => {
    // Pacientes desospitalizados no período com PTS avaliado
    const dischargeIds = new Set<string>();
    scopedMovements.filter(m => m.type === MovementType.DISCHARGE).forEach(m => dischargeIds.add(m.patientId));
    
    return scopedPatients.filter(p => {
      const isDischarged = p.status === PatientStatus.DISCHARGED || dischargeIds.has(p.id);
      const hasPrediction = !!p.predictedDischargeDate || (p.dischargePredictions && p.dischargePredictions.length > 0);
      return isDischarged && hasPrediction;
    });
  };

  const getMovementPatients = (mType: MovementType) => {
    const listMovements = scopedMovements.filter(m => m.type === mType);
    const pMap = new Map<string, Patient>();

    listMovements.forEach(m => {
      const found = scopedPatients.find(p => p.id === m.patientId);
      if (found) {
        pMap.set(found.id, found);
      } else {
        // Objeto sintético caso o paciente tenha sido removido dos ativos
        pMap.set(m.patientId, {
          id: m.patientId,
          name: m.patientName,
          sesId: 'SES N/A',
          gender: 'M' as any,
          age: 0,
          bed: m.bed,
          unitId: m.toUnit || m.fromUnit || '',
          entryDateHospital: m.date,
          admissionDate: m.date,
          diagnosis: `Evento: ${m.type}`,
          origin: m.fromUnit || 'Hospital',
          pendingTasks: [],
          status: mType === MovementType.DISCHARGE ? PatientStatus.DISCHARGED : mType === MovementType.DECEASED ? PatientStatus.DECEASED : PatientStatus.ADMITTED,
          isolationType: IsolationType.NONE,
          isExtra: false
        });
      }
    });

    return Array.from(pMap.values());
  };

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer group hover:scale-[1.02] duration-300"
    >
      <div className="flex items-center space-x-6">
        <div className={`p-4 rounded-2xl ${colorClass} group-hover:scale-110 transition-transform duration-300 shadow-md`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{title}</p>
          <p className="text-3xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
          {subtitle && <p className="text-[9px] font-bold text-indigo-500 uppercase mt-2">{subtitle}</p>}
        </div>
      </div>
      <div className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">
        <ChevronRight size={20} />
      </div>
    </div>
  );

  // Filtragem dos pacientes dentro do modal ativo
  const filteredModalPatients = useMemo(() => {
    if (!modalIndicator) return [];
    let list = modalIndicator.patients;

    if (modalUnitFilter !== 'ALL') {
      list = list.filter(p => p.unitId === modalUnitFilter);
    }

    if (modalSearchTerm.trim()) {
      const term = modalSearchTerm.toLowerCase();
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(term) ||
        (p.sesId || '').toLowerCase().includes(term) ||
        (p.bed || '').toLowerCase().includes(term) ||
        (p.diagnosis || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [modalIndicator, modalUnitFilter, modalSearchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-indigo-900 p-8 rounded-[3rem] shadow-xl text-white gap-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <LayoutDashboardIcon size={26} className="text-indigo-400" />
            Gestão de Indicadores
          </h2>
          <p className="text-xs font-bold text-indigo-300 uppercase mt-1">
            Status Operacional, Censo Diário & Auditoria Clínica (Clique nos cards para detalhar pacientes)
          </p>
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

      {/* Top 5 Cards Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Capacidade" 
          value={stats.leitoDia} 
          icon={Bed} 
          colorClass="bg-slate-800" 
          subtitle="Operacional" 
          onClick={() => openIndicator('CAPACIDADE', 'Capacidade Operacional', 'Todos os leitos ativos e pacientes no escopo selecionado', Bed, 'bg-slate-800 text-white', scopedPatients)}
        />
        <StatCard 
          title="Bloqueados" 
          value={stats.bloqueados} 
          icon={XCircle} 
          colorClass="bg-red-600" 
          subtitle="Indisponíveis" 
          onClick={() => openIndicator('BLOQUEADOS', 'Leitos Bloqueados', 'Leitos interditados por manutenção, higienização ou ordem médica', XCircle, 'bg-red-600 text-white', getBlockedPatients())}
        />
        <StatCard 
          title="Ocupados" 
          value={stats.ocupados} 
          icon={Users} 
          colorClass="bg-blue-600" 
          subtitle="Demanda" 
          onClick={() => openIndicator('OCUPADOS', 'Pacientes Ocupando Leitos', 'Pacientes atualmente internados, em estabilização ou isolamento', Users, 'bg-blue-600 text-white', getActivePatients())}
        />
        <StatCard 
          title="Ocupação" 
          value={`${stats.taxaOcupacao.toFixed(1)}%`} 
          icon={TrendingUp} 
          colorClass="bg-indigo-600" 
          subtitle="Eficiência" 
          onClick={() => openIndicator('OCUPACAO', 'Taxa de Ocupação', 'Relação de demanda assistencial sobre a capacidade total', TrendingUp, 'bg-indigo-600 text-white', getActivePatients())}
        />
        <StatCard 
          title="Permanência Média" 
          value={`${stats.tempoPermanencia.toFixed(1)}d`} 
          icon={Clock} 
          colorClass="bg-teal-600" 
          subtitle="Giro Médio" 
          onClick={() => {
            const sortedByStay = [...getActivePatients()].sort((a, b) => {
              const stayA = calculateStay(a.entryDateHospital, now).totalHours;
              const stayB = calculateStay(b.entryDateHospital, now).totalHours;
              return stayB - stayA;
            });
            openIndicator('PERMANENCIA', 'Permanência dos Pacientes', 'Pacientes ordenados pelo maior tempo de permanência hospitalar', Clock, 'bg-teal-600 text-white', sortedByStay);
          }}
        />
      </div>

      {/* Painel de Previsibilidade de Alta & Projeto Terapêutico Singular (PTS) */}
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <Sparkles className="text-indigo-600" size={24} />
              Previsibilidade de Alta & Gestão do PTS
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase">
              Acompanhamento de Metas de Saída e Assertividade do Projeto Terapêutico Singular
            </p>
          </div>
          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 uppercase flex items-center gap-1.5">
            <Target size={14} className="text-indigo-600" /> Meta Hospitalar: &ge; 80% Assertividade
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Previsão para Hoje" 
            value={stats.altasPrevistasHoje} 
            icon={CalendarCheck} 
            colorClass="bg-amber-500" 
            subtitle="Altas programadas para hoje" 
            onClick={() => openIndicator('ALTAS_HOJE', 'Altas Previstas para Hoje', 'Pacientes com alta clínica programada pelo PTS para o plantão de hoje', CalendarCheck, 'bg-amber-500 text-white', getTodayPredictionPatients())}
          />
          <StatCard 
            title="Próximos Dias" 
            value={stats.altasPrevistasProximosDias} 
            icon={CalendarDays} 
            colorClass="bg-blue-600" 
            subtitle="Previsão de giro nos próximos dias" 
            onClick={() => openIndicator('ALTAS_PROXIMAS', 'Altas nos Próximos Dias', 'Pacientes com desospitalização programada para os dias subsequentes', CalendarDays, 'bg-blue-600 text-white', getUpcomingPredictionPatients())}
          />
          <StatCard 
            title="Altas Atrasadas" 
            value={stats.altasAtrasadas} 
            icon={AlertTriangle} 
            colorClass={stats.altasAtrasadas > 0 ? "bg-rose-600" : "bg-slate-400"} 
            subtitle={stats.altasAtrasadas > 0 ? "Vencidas sem desfecho" : "Nenhum atraso ativo"} 
            onClick={() => openIndicator('ALTAS_ATRASADAS', 'Altas Atrasadas (PTS Vencido)', 'Pacientes cuja data prevista de alta foi ultrapassada e continuam internados', AlertTriangle, 'bg-rose-600 text-white', getDelayedPredictionPatients())}
          />
          <StatCard 
            title="Taxa de Assertividade" 
            value={`${stats.taxaAssertividadeAlta.toFixed(1)}%`} 
            icon={Target} 
            colorClass={stats.taxaAssertividadeAlta >= 80 ? "bg-emerald-600" : "bg-orange-500"} 
            subtitle={`${stats.altasAssertivasNoPrazo} de ${stats.totalAltasComPrevisao} no prazo ou antes`} 
            onClick={() => openIndicator('ASSERTIVIDADE', 'Taxa de Assertividade de Alta', 'Pacientes desospitalizados e avaliação de cumprimento da meta PTS programada', Target, 'bg-emerald-600 text-white', getAssertiveDischargePatients())}
          />
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-[10px] text-slate-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <span>
            <b>Critério do Indicador:</b> A taxa de assertividade contabiliza as desospitalizações bem-sucedidas ocorridas na data prevista ou antecipadamente, excluindo óbitos e evasões.
          </span>
          <span className="font-black text-indigo-600 uppercase">
            Protocolo Multidisciplinar HRT
          </span>
        </div>
      </div>

      {/* Gráficos e Giro Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                <BarChart3 className="text-indigo-600" /> Censo de Ocupação HRT
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Clique em uma barra para filtrar pacientes</p>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-4 py-1.5 rounded-full">Auditoria em Tempo Real</span>
          </div>
          <div className="h-64 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={100}>
              <BarChart data={kpiData} barGap={15}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 800, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar 
                  dataKey="value" 
                  radius={[10, 10, 10, 10]} 
                  barSize={80}
                  className="cursor-pointer"
                  onClick={(entry) => {
                    if (entry?.name === 'Internação') openIndicator('INTERNACAO', 'Censo: Internação', 'Pacientes em leitos de internação', Bed, 'bg-blue-600 text-white', scopedPatients.filter(p => p.status === PatientStatus.ADMITTED));
                    else if (entry?.name === 'Estabilização') openIndicator('ESTABILIZACAO', 'Censo: Estabilização', 'Pacientes em suporte e estabilização clínica', AlertTriangle, 'bg-amber-500 text-white', scopedPatients.filter(p => p.status === PatientStatus.STABILIZATION));
                    else if (entry?.name === 'Isolamento') openIndicator('ISOLAMENTO', 'Censo: Isolamento', 'Pacientes em protocolo de isolamento por precaução', Biohazard, 'bg-red-600 text-white', scopedPatients.filter(p => p.status === PatientStatus.ISOLATION || (p.isolationType && p.isolationType !== IsolationType.NONE)));
                    else if (entry?.name === 'Bloqueados') openIndicator('BLOQUEADOS', 'Censo: Bloqueados', 'Leitos bloqueados para manutenção ou desinfecção', XCircle, 'bg-slate-600 text-white', getBlockedPatients());
                  }}
                >
                  {kpiData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-8 text-center">Giro Kanban HRT</h3>
          <div className="h-48 w-full relative min-h-[190px]">
             <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={100}>
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
             <button 
                onClick={() => openIndicator('KANBAN_RED', 'Pacientes +10 Dias de Internação', 'Pacientes de longa permanência no hospital', AlertTriangle, 'bg-red-600 text-white', getActivePatients().filter(p => calculateStay(p.entryDateHospital, now).days >= 10))}
                className="w-full flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 rounded-2xl border border-red-100 text-red-700 transition-colors cursor-pointer group"
             >
                <span className="text-[10px] font-black uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  +10 Dias (Prioridade Alta)
                </span>
                <span className="text-lg font-black tabular-nums group-hover:scale-110 transition-transform">{stats.vermelhos}</span>
             </button>
             <button 
                onClick={() => openIndicator('KANBAN_YELLOW', 'Pacientes 5-10 Dias de Internação', 'Pacientes em permanência intermediária', Clock, 'bg-yellow-500 text-white', getActivePatients().filter(p => { const d = calculateStay(p.entryDateHospital, now).days; return d >= 5 && d < 10; }))}
                className="w-full flex items-center justify-between p-3 bg-yellow-50 hover:bg-yellow-100 rounded-2xl border border-yellow-100 text-yellow-700 transition-colors cursor-pointer group"
             >
                <span className="text-[10px] font-black uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                  5-10 Dias (Acompanhamento)
                </span>
                <span className="text-lg font-black tabular-nums group-hover:scale-110 transition-transform">{stats.amarelos}</span>
             </button>
             <button 
                onClick={() => openIndicator('KANBAN_GREEN', 'Pacientes < 5 Dias de Internação', 'Pacientes recém-admitidos ou em giro rápido', CheckCircle2, 'bg-green-600 text-white', getActivePatients().filter(p => calculateStay(p.entryDateHospital, now).days < 5))}
                className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-2xl border border-green-100 text-green-700 transition-colors cursor-pointer group"
             >
                <span className="text-[10px] font-black uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                  &lt; 5 Dias (Dentro do Prazo)
                </span>
                <span className="text-lg font-black tabular-nums group-hover:scale-110 transition-transform">{stats.verdes}</span>
             </button>
          </div>
        </div>
      </div>
      
      {/* Event Boxes Bottom */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <EventBox 
          title="Altas" 
          count={stats.alta} 
          color="emerald" 
          onClick={() => openIndicator('EVENT_ALTAS', 'Altas Hospitalares no Período', 'Pacientes desospitalizados no intervalo selecionado', UserCheck, 'bg-emerald-600 text-white', getMovementPatients(MovementType.DISCHARGE))}
        />
        <EventBox 
          title="Óbitos" 
          count={stats.obito} 
          color="slate" 
          onClick={() => openIndicator('EVENT_OBITOS', 'Óbitos Registrados', 'Pacientes com desfecho de óbito no intervalo selecionado', XCircle, 'bg-slate-700 text-white', getMovementPatients(MovementType.DECEASED))}
        />
        <EventBox 
          title="Evasões" 
          count={stats.evasao} 
          color="orange" 
          onClick={() => openIndicator('EVENT_EVASOES', 'Evasões Registradas', 'Registros de evasão hospitalar no intervalo selecionado', AlertTriangle, 'bg-orange-600 text-white', getMovementPatients(MovementType.EVASION))}
        />
        <EventBox 
          title="Transf. Externa" 
          count={stats.transferenciaExterna} 
          color="indigo" 
          onClick={() => openIndicator('EVENT_TRANSF_EXTERNA', 'Transferências Externas', 'Pacientes transferidos para outras unidades da rede', ArrowRight, 'bg-indigo-600 text-white', getMovementPatients(MovementType.EXTERNAL_TRANSFER))}
        />
        <EventBox 
          title="Transf. Internas" 
          count={stats.transferenciaInterna} 
          color="teal" 
          onClick={() => openIndicator('EVENT_TRANSF_INTERNA', 'Transferências Internas', 'Giro entre leitos e setores do próprio hospital', RefreshCw, 'bg-teal-600 text-white', getMovementPatients(MovementType.TRANSFER))}
        />
        <EventBox 
          title="Leitos Extras" 
          count={stats.extras} 
          color="purple" 
          onClick={() => openIndicator('EVENT_EXTRAS', 'Pacientes em Leitos Extras', 'Pacientes alocados em acomodações extraordinárias ou macas de apoio', Layers, 'bg-purple-600 text-white', getActivePatients().filter(p => p.isExtra))}
        />
      </div>

      {/* ========================================================== */}
      {/* MODAL DETALHADO DO INDICADOR & JORNADA DO PACIENTE         */}
      {/* ========================================================== */}
      {modalIndicator && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[200] overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-white/20 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl shadow-sm ${modalIndicator.badgeColorClass}`}>
                  <modalIndicator.icon size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                      {modalIndicator.title}
                    </h3>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-black text-xs uppercase">
                      {filteredModalPatients.length} {filteredModalPatients.length === 1 ? 'paciente' : 'pacientes'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    {modalIndicator.subtitle}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setModalIndicator(null); setSelectedPatientForJourney(null); }} 
                className="p-3 bg-white hover:bg-slate-200 rounded-full transition-all text-slate-400 border shadow-xs"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body: Modo Lista vs Modo Jornada do Paciente */}
            {selectedPatientForJourney ? (
              /* ======================================================= */
              /* VISUALIZAÇÃO DA JORNADA & AUDITORIA DO PACIENTE         */
              /* ======================================================= */
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {/* Barra de Retorno e Ações */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <button 
                    onClick={() => setSelectedPatientForJourney(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase transition-colors"
                  >
                    <ArrowLeft size={16} /> Voltar para lista ({modalIndicator.title})
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        onEditPatient?.(selectedPatientForJourney);
                        setModalIndicator(null);
                      }}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase flex items-center gap-2 shadow-md transition-all"
                    >
                      <Stethoscope size={16} /> Fazer Tratativa / Editar Paciente
                    </button>
                  </div>
                </div>

                {/* Perfil Clínico & Condição Atual */}
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900 uppercase">
                          {selectedPatientForJourney.name}
                        </span>
                        {selectedPatientForJourney.isExtra && (
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-black rounded-full uppercase">
                            Leito Extra
                          </span>
                        )}
                        {selectedPatientForJourney.isolationType && selectedPatientForJourney.isolationType !== IsolationType.NONE && (
                          <span className="px-2.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full uppercase flex items-center gap-1">
                            <Biohazard size={12} /> Isolamento ({selectedPatientForJourney.isolationType})
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-500 mt-1">
                        SES: <b>{selectedPatientForJourney.sesId}</b> | {selectedPatientForJourney.gender === 'M' ? 'Masculino' : 'Feminino'}, {selectedPatientForJourney.age} anos | Origem: {selectedPatientForJourney.origin || 'N/A'}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl uppercase">
                        Leito {selectedPatientForJourney.bed} • {units.find(u => u.id === selectedPatientForJourney.unitId)?.name || 'Setor N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Diagnóstico & Tempos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Diagnóstico Principal</p>
                      <p className="text-xs font-bold text-slate-800 uppercase mt-0.5">
                        {selectedPatientForJourney.diagnosis || 'Sem diagnóstico informado'}
                      </p>
                      {selectedPatientForJourney.etiologicalAgent && (
                        <p className="text-[10px] font-bold text-red-600 uppercase mt-1">
                          Agente: {selectedPatientForJourney.etiologicalAgent}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Estadia Total</p>
                      {(() => {
                        const stayH = calculateStay(selectedPatientForJourney.entryDateHospital, now);
                        const stayS = calculateStay(selectedPatientForJourney.admissionDate, now);
                        return (
                          <div className="text-xs font-bold text-slate-700 mt-0.5 space-y-0.5">
                            <div>Hospital: <span className="font-black text-slate-900">{stayH.days}d {stayH.hours}h</span></div>
                            <div>Setor: <span className="font-black text-indigo-600">{stayS.days}d {stayS.hours}h</span></div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Previsibilidade de Alta Atual */}
                  {selectedPatientForJourney.predictedDischargeDate ? (
                    <div className="p-4 bg-white rounded-2xl border border-indigo-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Target size={16} className="text-indigo-600" />
                          <span className="text-xs font-black uppercase text-indigo-900">
                            Meta Ativa do Projeto Terapêutico Singular (PTS)
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 mt-1">
                          Previsão de Alta: <b>{new Date(selectedPatientForJourney.predictedDischargeDate + 'T00:00:00').toLocaleDateString('pt-BR')}</b>
                        </p>
                      </div>

                      {(() => {
                        const predStatus = getDischargePredictionStatus(selectedPatientForJourney, now);
                        let badge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        let text = `No Prazo (${predStatus.daysRemaining}d)`;
                        if (predStatus.status === 'DELAYED') {
                          badge = 'bg-red-100 text-red-800 border-red-200 animate-pulse';
                          text = `Atrasada (+${Math.abs(predStatus.daysRemaining)}d)`;
                        } else if (predStatus.status === 'TODAY') {
                          badge = 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse';
                          text = 'Alta Prevista para Hoje';
                        } else if (predStatus.status === 'APPROACHING') {
                          badge = 'bg-blue-100 text-blue-800 border-blue-200';
                          text = `Alta Próxima (em ${predStatus.daysRemaining}d)`;
                        }

                        return (
                          <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase ${badge}`}>
                            {text}
                          </span>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between">
                      <span>Este paciente ainda não possui data de previsibilidade de alta definida.</span>
                      <button
                        onClick={() => {
                          onEditPatient?.(selectedPatientForJourney);
                          setModalIndicator(null);
                        }}
                        className="text-xs font-black underline uppercase hover:text-amber-900"
                      >
                        Definir agora
                      </button>
                    </div>
                  )}

                  {/* Pendências Ativas */}
                  {selectedPatientForJourney.pendingTasks && selectedPatientForJourney.pendingTasks.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Pendências Clínicas</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPatientForJourney.pendingTasks.map(t => (
                          <span key={t.id} className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                            • {t.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Linha do Tempo da Jornada na Auditoria */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                      <History size={18} className="text-indigo-600" />
                      Jornada do Paciente na Auditoria & Histórico de Movimentações
                    </h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      Rastreabilidade Total
                    </span>
                  </div>

                  {(() => {
                    const patientMovements = movements.filter(m => m.patientId === selectedPatientForJourney.id);
                    if (patientMovements.length === 0) {
                      return (
                        <div className="p-8 bg-slate-50 rounded-3xl text-center border border-dashed border-slate-200 text-slate-400 text-xs font-bold uppercase">
                          Nenhum registro de movimentação anterior localizado para este prontuário.
                        </div>
                      );
                    }

                    return (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                        {patientMovements.map(m => {
                          const isPTS = m.type === MovementType.PTS_PREDICTION;
                          return (
                            <div key={m.id} className="relative group">
                              {/* Dot */}
                              <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                                isPTS ? 'bg-purple-600' :
                                m.type === MovementType.DISCHARGE ? 'bg-emerald-600' :
                                m.type === MovementType.DECEASED ? 'bg-slate-700' :
                                m.type === MovementType.ADMISSION ? 'bg-blue-600' :
                                'bg-indigo-600'
                              }`} />

                              <div className="p-5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200/80 transition-all shadow-2xs space-y-2">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
                                  <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-1.5 ${
                                    isPTS ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                    m.type === MovementType.DISCHARGE ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                    m.type === MovementType.DECEASED ? 'bg-slate-200 text-slate-800' :
                                    'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {isPTS && <Target size={12} />}
                                    {m.type}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {new Date(m.date).toLocaleString('pt-BR')}
                                  </span>
                                </div>

                                <p className="text-xs font-bold text-slate-700 uppercase">
                                  {m.fromUnit || 'Início'} ➔ {m.toUnit || 'Saída'} (Leito {m.bed})
                                </p>

                                {m.details && (
                                  <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100 text-xs font-bold text-purple-900 leading-relaxed">
                                    {m.details}
                                  </div>
                                )}

                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                  Registrado por: <b>{m.collaborator?.name || 'Sistema'}</b> ({m.collaborator?.category || 'Colaborador'})
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* ======================================================= */
              /* LISTAGEM DE PACIENTES DO INDICADOR SELECIONADO          */
              /* ======================================================= */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Filtros e Busca dentro do Modal */}
                <div className="p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Pesquisar por Nome, SES, Leito ou Diagnóstico..."
                      value={modalSearchTerm}
                      onChange={e => setModalSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {currentUnitId === 'global' && units.length > 0 && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Layers size={16} className="text-slate-400" />
                      <select
                        value={modalUnitFilter}
                        onChange={e => setModalUnitFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold uppercase outline-none cursor-pointer"
                      >
                        <option value="ALL">Todas as Unidades</option>
                        {units.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Tabela / Cards de Pacientes */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  {filteredModalPatients.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <Users size={32} />
                      </div>
                      <p className="text-sm font-black text-slate-600 uppercase">Nenhum paciente encontrado</p>
                      <p className="text-xs text-slate-400">Não há registros correspondentes aos critérios deste indicador no momento.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredModalPatients.map(patient => {
                        const unitName = units.find(u => u.id === patient.unitId)?.name || 'Setor N/A';
                        const stayGlobal = calculateStay(patient.entryDateHospital, now);
                        const predStatus = getDischargePredictionStatus(patient, now);

                        return (
                          <div 
                            key={patient.id}
                            className="bg-slate-50 hover:bg-indigo-50/40 p-6 rounded-[2rem] border border-slate-200 transition-all shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 group"
                          >
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs rounded-xl uppercase">
                                  Leito {patient.bed}
                                </span>
                                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl">
                                  {unitName}
                                </span>
                                {patient.isExtra && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-black rounded-full uppercase">
                                    Extra
                                  </span>
                                )}
                                {patient.isolationType && patient.isolationType !== IsolationType.NONE && (
                                  <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full uppercase flex items-center gap-1">
                                    <Biohazard size={10} /> Isolamento
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 className="text-sm font-black text-slate-900 uppercase">
                                  {patient.name}
                                </h4>
                                <p className="text-[11px] font-bold text-slate-500">
                                  SES: <b>{patient.sesId}</b> | {patient.gender}/{patient.age}a | Procedência: {patient.origin || 'N/A'}
                                </p>
                              </div>

                              <p className="text-xs font-bold text-slate-700 uppercase line-clamp-2">
                                Diagnóstico: {patient.diagnosis || 'Sem diagnóstico informado'}
                              </p>

                              {/* Permanência & Previsibilidade */}
                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                  Permanência: <b>{stayGlobal.days}d {stayGlobal.hours}h</b>
                                </span>

                                {predStatus.hasPrediction ? (
                                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase flex items-center gap-1 ${
                                    predStatus.status === 'DELAYED' ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                                    predStatus.status === 'TODAY' ? 'bg-amber-400 text-slate-900 border-amber-500 font-black animate-pulse' :
                                    predStatus.status === 'APPROACHING' ? 'bg-blue-600 text-white border-blue-700' :
                                    'bg-emerald-600 text-white border-emerald-700'
                                  }`}>
                                    <Target size={12} />
                                    {predStatus.status === 'DELAYED' ? `Alta Atrasada (+${Math.abs(predStatus.daysRemaining)}d)` :
                                     predStatus.status === 'TODAY' ? 'Alta Prevista: HOJE' :
                                     predStatus.status === 'APPROACHING' ? `Alta em ${predStatus.daysRemaining}d` :
                                     `No Prazo (${predStatus.daysRemaining}d)`} • {predStatus.formattedDate}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-dashed border-slate-300">
                                    Sem Previsão PTS
                                  </span>
                                )}

                                {predStatus.isRecalculated && (
                                  <span className="text-[9px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md uppercase">
                                    PTS Recalculado ({predStatus.totalPredictionsCount}ª)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Botões de Ação por Paciente */}
                            <div className="flex flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                              <button
                                onClick={() => setSelectedPatientForJourney(patient)}
                                className="flex-1 lg:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-sm transition-all"
                              >
                                <History size={14} className="text-indigo-400" />
                                Ver Jornada
                              </button>

                              <button
                                onClick={() => {
                                  onEditPatient?.(patient);
                                  setModalIndicator(null);
                                }}
                                className="flex-1 lg:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-sm transition-all"
                              >
                                <Stethoscope size={14} />
                                Tratativa / Editar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EventBox = ({ title, count, color, onClick }: any) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300',
    slate: 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-300',
    orange: 'bg-orange-50 text-orange-700 border-orange-100 hover:border-orange-300',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300',
    teal: 'bg-teal-50 text-teal-700 border-teal-100 hover:border-teal-300',
    purple: 'bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-300'
  };
  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-[2rem] border-2 ${colors[color]} flex flex-col items-center justify-center text-center shadow-sm hover:scale-105 transition-all duration-300 cursor-pointer group`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest mb-2 leading-none">{title}</p>
      <p className="text-3xl font-black tabular-nums leading-none">{count}</p>
      <span className="text-[8px] font-bold uppercase mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        Ver Detalhes <ArrowRight size={10} />
      </span>
    </div>
  );
};

const LayoutDashboardIcon = ({ size, className }: any) => (
  <svg 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

export default Dashboard;
