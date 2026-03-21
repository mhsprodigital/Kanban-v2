
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
  UNBLOCKAGE = 'DESBLOQUEIO DE LEITO'
}

export enum Gender {
  M = 'M',
  F = 'F'
}

export interface PendingTask {
  id: string;
  description: string;
  createdAt: string;
  expiresAt?: string;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface Collaborator {
  uid?: string;
  email?: string;
  name: string;
  category: string;
  role?: UserRole;
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
  predictedDischargeDate?: string; // Previsibilidade de alta
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
}
