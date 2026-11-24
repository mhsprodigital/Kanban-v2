import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  HospitalUnit,
  Patient,
  PatientMovement,
  UserInvitation,
  Collaborator,
  AccessLog,
  PatientStatus,
} from '../types';
import {
  calculateStay,
  getAutoPriority,
  getDischargePredictionStatus,
  getStats,
  getGlobalStats,
} from './calculations';

export type ExportDatasetKey =
  | 'units'
  | 'users'
  | 'logs'
  | 'movements'
  | 'active_board'
  | 'indicators'
  | 'all';

export interface FullDatabaseSnapshot {
  units: HospitalUnit[];
  allPatients: Patient[];
  activePatients: Patient[];
  movements: PatientMovement[];
  invitations: (UserInvitation & { id?: string })[];
  users: Collaborator[];
  accessLogs: AccessLog[];
}

const formatDateTimeBR = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR');
};

const formatDateOnlyBR = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('pt-BR');
};

const getFileTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
};

/**
 * Busca a base completa diretamente do Firestore (sem limites de listener)
 * fazendo fallback seguro para os dados em memória caso ocorra falha pontual.
 */
export const fetchCompleteDatabaseSnapshot = async (fallback: {
  units: HospitalUnit[];
  patients: Patient[];
  movements: PatientMovement[];
  invitations: (UserInvitation & { id?: string })[];
  users: Collaborator[];
  accessLogs: AccessLog[];
}): Promise<FullDatabaseSnapshot> => {
  const [
    unitsSnap,
    patientsSnap,
    movementsSnap,
    invitationsSnap,
    usersSnap,
    logsSnap,
  ] = await Promise.allSettled([
    getDocs(collection(db, 'units')),
    getDocs(collection(db, 'patients')),
    getDocs(collection(db, 'movements')),
    getDocs(collection(db, 'invitations')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'access_logs')),
  ]);

  const units: HospitalUnit[] =
    unitsSnap.status === 'fulfilled'
      ? unitsSnap.value.docs.map((d) => ({
          id: d.id,
          name: d.data().name || '',
          capacity: Number(d.data().capacity || 0),
          bedNames: d.data().bedNames || [],
        }))
      : fallback.units;

  const allPatients: Patient[] =
    patientsSnap.status === 'fulfilled'
      ? patientsSnap.value.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            unitId: data.unitId || '',
            bed: data.bed || '',
            sesId: data.sesId || '',
            name: data.name || '',
            gender: data.gender,
            age: data.age ?? 0,
            entryDateHospital: data.entryDateHospital || '',
            admissionDate: data.admissionDate || '',
            dischargeDate: data.dischargeDate || undefined,
            origin: data.origin || '',
            externalDestination: data.externalDestination || undefined,
            diagnosis: data.diagnosis || '',
            etiologicalAgent: data.etiologicalAgent || undefined,
            status: data.status,
            isolationType: data.isolationType,
            isExtra: Boolean(data.isExtra),
            blockReason: data.blockReason || undefined,
            pendingTasks: data.pendingTasks || [],
            predictedDischargeDate: data.predictedDischargeDate || undefined,
            dischargePredictions: data.dischargePredictions || [],
          } as Patient;
        })
      : fallback.patients;

  const activePatients = allPatients.filter(
    (p) =>
      ![
        PatientStatus.DISCHARGED,
        PatientStatus.DECEASED,
        PatientStatus.EVASION,
        PatientStatus.TRANSFERRED,
      ].includes(p.status)
  );

  const movements: PatientMovement[] =
    movementsSnap.status === 'fulfilled'
      ? movementsSnap.value.docs
          .map((d) => ({ id: d.id, ...d.data() } as PatientMovement))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      : fallback.movements;

  const invitations: (UserInvitation & { id?: string })[] =
    invitationsSnap.status === 'fulfilled'
      ? invitationsSnap.value.docs.map(
          (d) => ({ id: d.id, ...d.data() } as UserInvitation & { id?: string })
        )
      : fallback.invitations;

  const users: Collaborator[] =
    usersSnap.status === 'fulfilled'
      ? usersSnap.value.docs.map(
          (d) => ({ uid: d.id, ...d.data() } as Collaborator)
        )
      : fallback.users;

  const accessLogs: AccessLog[] =
    logsSnap.status === 'fulfilled'
      ? logsSnap.value.docs
          .map((d) => ({ id: d.id, ...d.data() } as AccessLog))
          .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      : fallback.accessLogs;

  return {
    units,
    allPatients,
    activePatients,
    movements,
    invitations,
    users,
    accessLogs,
  };
};

// 1. Setores e Leitos
export const buildUnitsAndBedsRows = (
  units: HospitalUnit[],
  activePatients: Patient[]
): Record<string, any>[] => {
  const sortedUnits = [...units].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
  const rows: Record<string, any>[] = [];

  sortedUnits.forEach((unit) => {
    const cap = unit.capacity || 0;
    if (cap === 0) {
      rows.push({
        'ID Setor': unit.id,
        'Setor / Unidade': unit.name,
        'Capacidade Total': 0,
        'Número Leito': '---',
        'Identificação do Leito': '---',
        'Situação do Leito': 'SEM LEITOS',
        'Paciente Atual': '',
        'SES (Prontuário)': '',
        'Status Clínico': '',
        'Motivo Bloqueio': '',
      });
    } else {
      for (let i = 0; i < cap; i++) {
        const bedNum = String(i + 1);
        const customName = unit.bedNames?.[i] || `L-${bedNum}`;
        const occupant = activePatients.find(
          (p) => p.unitId === unit.id && p.bed === bedNum
        );
        const isBlocked = occupant?.status === PatientStatus.BLOCKED;

        rows.push({
          'ID Setor': unit.id,
          'Setor / Unidade': unit.name,
          'Capacidade Total': cap,
          'Número Leito': bedNum,
          'Identificação do Leito': customName,
          'Situação do Leito': isBlocked
            ? 'BLOQUEADO'
            : occupant
            ? 'OCUPADO'
            : 'LIVRE',
          'Paciente Atual': isBlocked ? '' : occupant?.name || '',
          'SES (Prontuário)': isBlocked ? '' : occupant?.sesId || '',
          'Status Clínico': occupant?.status || '',
          'Motivo Bloqueio': isBlocked
            ? occupant?.blockReason || occupant?.diagnosis || ''
            : '',
        });
      }
    }

    // Incluir eventuais leitos extras ocupados nessa unidade
    const extraPatients = activePatients.filter(
      (p) => p.unitId === unit.id && p.isExtra
    );
    extraPatients.forEach((ep) => {
      rows.push({
        'ID Setor': unit.id,
        'Setor / Unidade': unit.name,
        'Capacidade Total': cap,
        'Número Leito': ep.bed,
        'Identificação do Leito': `${ep.bed} (EXTRA)`,
        'Situação do Leito': 'OCUPADO (EXTRA)',
        'Paciente Atual': ep.name,
        'SES (Prontuário)': ep.sesId,
        'Status Clínico': ep.status,
        'Motivo Bloqueio': '',
      });
    });
  });

  return rows;
};

// 2. Usuários (Convites + Perfis ativos)
export const buildUsersRows = (
  invitations: (UserInvitation & { id?: string })[],
  users: Collaborator[]
): Record<string, any>[] => {
  const rows: Record<string, any>[] = [];
  const seenUids = new Set<string>();
  const seenUsernames = new Set<string>();

  invitations.forEach((inv) => {
    const uname = (inv.username || inv.id || '').toLowerCase();
    if (inv.uid) seenUids.add(inv.uid);
    if (uname) seenUsernames.add(uname);
    const linkedProfile = inv.uid
      ? users.find((u) => u.uid === inv.uid)
      : users.find((u) => (u.username || '').toLowerCase() === uname);

    rows.push({
      Username: inv.username || inv.id || '',
      'Nome Completo': inv.name || linkedProfile?.name || '',
      Setor: inv.setor || linkedProfile?.setor || '',
      Cargo: inv.cargo || linkedProfile?.cargo || '',
      'Papel (Permissão)': inv.role === 'admin' ? 'Administrador' : 'Usuário',
      Status:
        inv.status === 'active'
          ? 'Ativo'
          : inv.status === 'blocked'
          ? 'Bloqueado'
          : 'Pendente',
      'Reset Solicitado': inv.resetRequested ? 'Sim' : 'Não',
      'E-mail Interno / Auth': inv.authEmail || linkedProfile?.email || '',
      'UID Firebase': inv.uid || linkedProfile?.uid || '',
    });
  });

  // Perfis em 'users' sem entrada correspondente em 'invitations' (ex: admins Google)
  users.forEach((u) => {
    const uname = (u.username || '').toLowerCase();
    if ((u.uid && seenUids.has(u.uid)) || (uname && seenUsernames.has(uname))) {
      return;
    }
    rows.push({
      Username: u.username || u.email || '',
      'Nome Completo': u.name || '',
      Setor: u.setor || '',
      Cargo: u.cargo || u.category || '',
      'Papel (Permissão)':
        u.role === 'admin' ? 'Administrador' : 'Usuário',
      Status:
        u.status === 'active'
          ? 'Ativo'
          : u.status === 'blocked'
          ? 'Bloqueado'
          : 'Pendente',
      'Reset Solicitado': 'Não',
      'E-mail Interno / Auth': u.email || '',
      'UID Firebase': u.uid || '',
    });
  });

  return rows;
};

// 3. Logs de Acesso
export const buildAccessLogsRows = (
  accessLogs: AccessLog[]
): Record<string, any>[] => {
  return accessLogs.map((log) => ({
    'ID Log': log.id,
    'Data e Hora': formatDateTimeBR(log.timestamp),
    'Timestamp ISO': log.timestamp || '',
    Usuário: log.name || '',
    Email: log.email || '',
    'Categoria / Perfil': log.category || '',
    'ID Usuário (UID)': log.userId || '',
  }));
};

// 4. Histórico de Movimentações & Auditoria
export const buildMovementsRows = (
  movements: PatientMovement[]
): Record<string, any>[] => {
  return movements.map((m) => ({
    'ID Movimentação': m.id,
    'Data e Hora': formatDateTimeBR(m.date),
    'Timestamp ISO': m.date || '',
    'Tipo de Evento': m.type || '',
    Paciente: m.patientName || '',
    'ID Paciente': m.patientId || '',
    Leito: m.bed ? `L-${m.bed}` : '',
    'Origem (De)': m.fromUnit || '---',
    'Destino (Para)': m.toUnit || '---',
    'Detalhes / Justificativa PTS': m.details || '',
    'Responsável (Nome)': m.collaborator?.name || 'Sistema',
    'Responsável (Categoria)': m.collaborator?.category || '',
    'Responsável (Email/Username)':
      m.collaborator?.email || m.collaborator?.username || '',
  }));
};

// 5. Quadro Ativo (e Base Completa de Pacientes)
export const buildPatientsRows = (
  patientsList: Patient[],
  units: HospitalUnit[]
): Record<string, any>[] => {
  const now = Date.now();
  const unitMap = new Map<string, HospitalUnit>();
  units.forEach((u) => unitMap.set(u.id, u));

  return [...patientsList]
    .sort((a, b) => {
      const uA = unitMap.get(a.unitId)?.name || '';
      const uB = unitMap.get(b.unitId)?.name || '';
      if (uA !== uB) return uA.localeCompare(uB);
      return (parseInt(a.bed, 10) || 0) - (parseInt(b.bed, 10) || 0);
    })
    .map((p) => {
      const unit = unitMap.get(p.unitId);
      const bedIdx = parseInt(p.bed, 10) - 1;
      const bedLabel =
        !isNaN(bedIdx) && unit?.bedNames?.[bedIdx]
          ? unit.bedNames[bedIdx]
          : `L-${p.bed}`;
      const stay = calculateStay(p.entryDateHospital, now);
      const priority =
        p.status === PatientStatus.BLOCKED
          ? 'BLOQUEADO'
          : getAutoPriority(p.entryDateHospital, now);
      const predStatus = getDischargePredictionStatus(p, now);

      const predStatusLabel = !predStatus.hasPrediction
        ? 'Sem Previsão'
        : predStatus.status === 'DELAYED'
        ? `Atrasada (${Math.abs(predStatus.daysRemaining)}d)`
        : predStatus.status === 'TODAY'
        ? 'Prevista para Hoje'
        : predStatus.status === 'APPROACHING'
        ? `Próxima (${predStatus.daysRemaining}d)`
        : `No Prazo (${predStatus.daysRemaining}d)`;

      const pendingSummary = (p.pendingTasks || [])
        .map((t) =>
          t.expiresAt
            ? `${t.description} (Val: ${formatDateOnlyBR(t.expiresAt)})`
            : t.description
        )
        .join(' | ');

      const predictionsHistorySummary = (p.dischargePredictions || [])
        .map(
          (dp, idx) =>
            `${idx + 1}ª: ${formatDateOnlyBR(dp.predictedDate)} (${dp.reason || 'Sem justificativa'})`
        )
        .join(' | ');

      return {
        'ID Registro': p.id,
        'Setor / Unidade': unit?.name || p.unitId || '',
        Leito: bedLabel,
        'Leito Extra': p.isExtra ? 'Sim' : 'Não',
        'SES (Prontuário)': p.sesId || '',
        'Nome do Paciente': p.name || '',
        Sexo: p.gender || '',
        Idade: p.age ?? '',
        'Status Clínico': p.status || '',
        'Prioridade Kanban (Permanência)': priority,
        'Permanência (Dias / Horas)': `${stay.days}d ${stay.hours}h`,
        'Entrada Hospital': formatDateTimeBR(p.entryDateHospital),
        'Admissão Setor': formatDateTimeBR(p.admissionDate),
        'Data Desfecho / Alta': formatDateTimeBR(p.dischargeDate),
        'Procedência / Origem': p.origin || '',
        'Destino Externo': p.externalDestination || '',
        'Tipo de Isolamento': p.isolationType || '',
        'Agente Etiológico': p.etiologicalAgent || '',
        'Diagnóstico e Clínica': p.diagnosis || '',
        'Motivo Bloqueio': p.blockReason || '',
        'Previsibilidade de Alta (PTS Atual)': formatDateOnlyBR(
          p.predictedDischargeDate
        ),
        'Situação Meta PTS': predStatusLabel,
        'Qtd Revisões PTS': predStatus.totalPredictionsCount,
        'Histórico Previsões PTS': predictionsHistorySummary,
        'Pendências Ativas': pendingSummary,
      };
    });
};

// 6. Registro da Gestão de Indicadores (Consolidado Geral + Por Setor)
export const buildIndicatorsRows = (
  allPatients: Patient[],
  units: HospitalUnit[],
  movements: PatientMovement[],
  startDate: string,
  endDate: string
): Record<string, any>[] => {
  const rows: Record<string, any>[] = [];
  const startBR = formatDateOnlyBR(startDate);
  const endBR = formatDateOnlyBR(endDate);

  const mapStatsToRow = (scopeName: string, s: ReturnType<typeof getGlobalStats>) => ({
    'Escopo / Setor': scopeName,
    'Período Início': startBR,
    'Período Fim': endBR,
    'Total de Leitos': s.totalLeitos,
    Ocupados: s.ocupados,
    'Taxa de Ocupação (%)': Number(s.taxaOcupacao.toFixed(1)),
    Internação: s.internacao,
    Estabilização: s.estabilizacao,
    Isolamento: s.isolamento,
    Bloqueados: s.bloqueados,
    'Leitos Extras': s.extras,
    'Tempo Médio Permanência (dias)': Number(s.tempoPermanencia.toFixed(1)),
    'Dias de Internação Total': s.diasInternacaoTotal,
    'Kanban Vermelho (+10d)': s.vermelhos,
    'Kanban Amarelo (5-10d)': s.amarelos,
    'Kanban Verde (<5d)': s.verdes,
    'Altas no Período': s.alta,
    'Óbitos no Período': s.obito,
    'Evasões no Período': s.evasao,
    'Transferências Internas': s.transferenciaInterna,
    'Transferências Externas': s.transferenciaExterna,
    'PTS - Altas Previstas Hoje': s.altasPrevistasHoje,
    'PTS - Altas Próximos Dias': s.altasPrevistasProximosDias,
    'PTS - Altas Atrasadas': s.altasAtrasadas,
    'PTS - Total Altas com Previsão': s.totalAltasComPrevisao,
    'PTS - Altas Assertivas no Prazo': s.altasAssertivasNoPrazo,
    'PTS - Taxa de Assertividade (%)': Number(
      s.taxaAssertividadeAlta.toFixed(1)
    ),
  });

  // Linha consolidada do Hospital Geral
  const globalStats = getGlobalStats(
    allPatients,
    units,
    movements,
    startDate,
    endDate
  );
  rows.push(mapStatsToRow('HOSPITAL GERAL (CONSOLIDADO)', globalStats));

  // Uma linha por unidade/setor
  const sortedUnits = [...units].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
  sortedUnits.forEach((unit) => {
    const unitStats = getStats(
      allPatients,
      unit,
      movements,
      startDate,
      endDate
    );
    rows.push(mapStatsToRow(unit.name, unitStats));
  });

  return rows;
};

const autoFitColumns = (rows: Record<string, any>[]): XLSX.ColInfo[] => {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((header) => {
    let maxLen = header.length;
    rows.forEach((row) => {
      const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 60) };
  });
};

const appendSheet = (
  wb: XLSX.WorkBook,
  sheetName: string,
  rows: Record<string, any>[],
  emptyHeaders: string[]
) => {
  const safeRows =
    rows.length > 0
      ? rows
      : [
          emptyHeaders.reduce((acc, h) => {
            acc[h] = '';
            return acc;
          }, {} as Record<string, any>),
        ];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  ws['!cols'] = autoFitColumns(safeRows);
  // Limite de 31 caracteres no nome da aba no Excel
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
};

const downloadCSVFromRows = (
  filename: string,
  rows: Record<string, any>[],
  emptyHeaders: string[]
) => {
  const safeRows =
    rows.length > 0
      ? rows
      : [
          emptyHeaders.reduce((acc, h) => {
            acc[h] = '';
            return acc;
          }, {} as Record<string, any>),
        ];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  const csv = '\ufeff' + XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportDatabase = async (options: {
  dataset: ExportDatasetKey;
  format: 'xlsx' | 'csv';
  startDate: string;
  endDate: string;
  fallbackData: {
    units: HospitalUnit[];
    patients: Patient[];
    movements: PatientMovement[];
    invitations: (UserInvitation & { id?: string })[];
    users: Collaborator[];
    accessLogs: AccessLog[];
  };
}): Promise<{ counts: Record<string, number> }> => {
  const { dataset, format, startDate, endDate, fallbackData } = options;
  const snapshot = await fetchCompleteDatabaseSnapshot(fallbackData);
  const stamp = getFileTimestamp();

  const unitsRows = buildUnitsAndBedsRows(snapshot.units, snapshot.activePatients);
  const usersRows = buildUsersRows(snapshot.invitations, snapshot.users);
  const logsRows = buildAccessLogsRows(snapshot.accessLogs);
  const movementsRows = buildMovementsRows(snapshot.movements);
  const activeBoardRows = buildPatientsRows(snapshot.activePatients, snapshot.units);
  const allPatientsRows = buildPatientsRows(snapshot.allPatients, snapshot.units);
  const indicatorsRows = buildIndicatorsRows(
    snapshot.allPatients,
    snapshot.units,
    snapshot.movements,
    startDate,
    endDate
  );

  const counts = {
    units: unitsRows.length,
    users: usersRows.length,
    logs: logsRows.length,
    movements: movementsRows.length,
    active_board: activeBoardRows.length,
    all_patients: allPatientsRows.length,
    indicators: indicatorsRows.length,
  };

  if (dataset === 'all') {
    const wb = XLSX.utils.book_new();
    appendSheet(wb, 'Quadro Ativo', activeBoardRows, ['Setor / Unidade', 'Leito', 'SES (Prontuário)', 'Nome do Paciente', 'Status Clínico']);
    appendSheet(wb, 'Setores e Leitos', unitsRows, ['ID Setor', 'Setor / Unidade', 'Capacidade Total', 'Número Leito', 'Situação do Leito']);
    appendSheet(wb, 'Gestão de Indicadores', indicatorsRows, ['Escopo / Setor', 'Período Início', 'Período Fim', 'Total de Leitos', 'Ocupados']);
    appendSheet(wb, 'Auditoria e Movimentações', movementsRows, ['ID Movimentação', 'Data e Hora', 'Tipo de Evento', 'Paciente', 'Leito']);
    appendSheet(wb, 'Usuários', usersRows, ['Username', 'Nome Completo', 'Setor', 'Cargo', 'Papel (Permissão)', 'Status']);
    appendSheet(wb, 'Logs de Acesso', logsRows, ['ID Log', 'Data e Hora', 'Usuário', 'Email', 'Categoria / Perfil']);
    appendSheet(wb, 'Base Completa Pacientes', allPatientsRows, ['ID Registro', 'Setor / Unidade', 'Leito', 'SES (Prontuário)', 'Nome do Paciente', 'Status Clínico']);

    XLSX.writeFile(wb, `backup_completo_kanban_hrt_${stamp}.xlsx`);
    return { counts };
  }

  const datasetMap: Record<
    Exclude<ExportDatasetKey, 'all'>,
    {
      filenameBase: string;
      sheetName: string;
      rows: Record<string, any>[];
      emptyHeaders: string[];
    }
  > = {
    units: {
      filenameBase: `setores_e_leitos_hrt_${stamp}`,
      sheetName: 'Setores e Leitos',
      rows: unitsRows,
      emptyHeaders: ['ID Setor', 'Setor / Unidade', 'Capacidade Total', 'Número Leito', 'Situação do Leito'],
    },
    users: {
      filenameBase: `usuarios_hrt_${stamp}`,
      sheetName: 'Usuários',
      rows: usersRows,
      emptyHeaders: ['Username', 'Nome Completo', 'Setor', 'Cargo', 'Papel (Permissão)', 'Status'],
    },
    logs: {
      filenameBase: `logs_de_acesso_hrt_${stamp}`,
      sheetName: 'Logs de Acesso',
      rows: logsRows,
      emptyHeaders: ['ID Log', 'Data e Hora', 'Usuário', 'Email', 'Categoria / Perfil'],
    },
    movements: {
      filenameBase: `auditoria_movimentacoes_hrt_${stamp}`,
      sheetName: 'Auditoria e Movimentações',
      rows: movementsRows,
      emptyHeaders: ['ID Movimentação', 'Data e Hora', 'Tipo de Evento', 'Paciente', 'Leito'],
    },
    active_board: {
      filenameBase: `quadro_ativo_hrt_${stamp}`,
      sheetName: 'Quadro Ativo',
      rows: activeBoardRows,
      emptyHeaders: ['Setor / Unidade', 'Leito', 'SES (Prontuário)', 'Nome do Paciente', 'Status Clínico'],
    },
    indicators: {
      filenameBase: `gestao_indicadores_hrt_${stamp}`,
      sheetName: 'Gestão de Indicadores',
      rows: indicatorsRows,
      emptyHeaders: ['Escopo / Setor', 'Período Início', 'Período Fim', 'Total de Leitos', 'Ocupados'],
    },
  };

  const target = datasetMap[dataset];
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    appendSheet(wb, target.sheetName, target.rows, target.emptyHeaders);
    XLSX.writeFile(wb, `${target.filenameBase}.xlsx`);
  } else {
    downloadCSVFromRows(`${target.filenameBase}.csv`, target.rows, target.emptyHeaders);
  }

  return { counts };
};
