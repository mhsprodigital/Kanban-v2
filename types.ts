
export enum PatientPriority {
  RED = 'VERMELHO',
  YELLOW = 'AMARELO',
  GREEN = 'VERDE'
}

export enum PatientStatus {
  ADMITTED = 'INTERNADO',
  STABILIZATION = 'ESTABILIZAÇÃO',
  ISOLATION = 'ISOLAMENTO',
  DISCHARGED = 'ALTA',
  DECEASED = 'ÓBITO',
  EVASION = 'EVASÃO',
  TRANSFERRED = 'TRANSFERÊNCIA',
  BLOCKED = 'BLOQUEADO',
  DELETED = 'EXCLUIR REGISTRO'
}

export enum IsolationType {
  CONTACT = 'CONTATO',
  DROPLET = 'GOTÍCULA',
  AEROSOL = 'AEROSSOL',
  NONE = 'PADRÃO'
}

export enum MovementType {
  ADMISSION = 'ADMISSÃO',
  TRANSFER = 'TRANSFERÊNCIA INTERNA',
  EXTERNAL_TRANSFER = 'TRANSFERÊNCIA EXTERNA',
  DISCHARGE = 'ALTA',
  DECEASED = 'ÓBITO',
  EVASION = 'EVASÃO',
  DELETION = 'EXCLUSÃO DE REGISTRO',
  BLOCKAGE = 'BLOQUEIO DE LEITO',
  UNBLOCKAGE = 'DESBLOQUEIO DE LEITO',
  PTS_PREDICTION = 'PREVISIBILIDADE DE ALTA'
}

export enum Gender {
  M = 'M',
  F = 'F'
}

export interface DischargePrediction {
  id: string;
  predictedDate: string; // YYYY-MM-DD
  reason?: string; // Justificativa da previsão ou reprogramação do PTS
  createdAt: string;
  createdBy?: string;
  previousDate?: string;
}

export interface PendingTask {
  id: string;
  description: string;
  createdAt: string;
  expiresAt?: string;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'blocked';

export interface UserInvitation {
  username: string;
  name: string;
  role: UserRole;
  setor?: string;
  cargo?: string;
  authEmail: string;
  authVersion: number;
  status: UserStatus;
  resetRequested: boolean;
  uid: string | null;
}

export interface UserProfile {
  uid: string;
  username: string;
  name: string;
  role: UserRole;
  setor?: string;
  cargo?: string;
  status: UserStatus;
}

export interface Collaborator {
  uid?: string;
  username?: string;
  email?: string;
  name: string;
  category: string;
  role?: UserRole;
  setor?: string;
  cargo?: string;
  status?: UserStatus;
  unitId?: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  name: string;
  category: string;
  email: string;
  timestamp: string;
}

export interface HospitalUnit {
  id: string;
  name: string;
  capacity: number;
  bedNames?: string[]; // Nomes personalizados para os leitos
}

export interface Patient {
  id: string;
  unitId: string;
  bed: string;
  sesId: string;
  name: string;
  gender: Gender;
  age: number;
  entryDateHospital: string;
  admissionDate: string;
  dischargeDate?: string;
  origin: string;
  externalDestination?: string;
  diagnosis: string;
  etiologicalAgent?: string;
  pendingTasks: PendingTask[];
  status: PatientStatus;
  isolationType: IsolationType;
  isExtra: boolean;
  blockReason?: string; // Justificativa para bloqueio de leito
  predictedDischargeDate?: string; // Previsibilidade de alta atual (YYYY-MM-DD)
  dischargePredictions?: DischargePrediction[]; // Histórico completo de revisões de previsibilidade de alta (PTS)
}

export interface PatientMovement {
  id: string;
  patientId: string;
  patientName: string;
  type: MovementType;
  date: string;
  fromUnit?: string;
  toUnit?: string;
  bed: string;
  collaborator: Collaborator;
  details?: string; // Informações adicionais (ex: detalhes da previsão de alta / PTS)
}

export interface DashboardStats {
  totalLeitos: number;
  ocupados: number;
  internacao: number;
  extras: number;
  leitoDia: number;
  estabilizacao: number;
  isolamento: number;
  bloqueados: number;
  obito: number;
  evasao: number;
  alta: number;
  transferenciaInterna: number;
  transferenciaExterna: number;
  taxaOcupacao: number;
  tempoPermanencia: number;
  diasInternacaoTotal: number;
  vermelhos: number;
  amarelos: number;
  verdes: number;
  // Indicadores de Previsibilidade de Alta (PTS)
  altasPrevistasHoje: number;
  altasPrevistasProximosDias: number;
  altasAtrasadas: number;
  taxaAssertividadeAlta: number;
  totalAltasComPrevisao: number;
  altasAssertivasNoPrazo: number;
}
