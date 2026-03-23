
import { Patient, DashboardStats, PatientStatus, PatientPriority, HospitalUnit, PatientMovement, MovementType } from '../types';

export interface StayDuration {
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
}

export const calculateStay = (admissionDate: string, now: number = Date.now()): StayDuration => {
  if (!admissionDate) return { days: 0, hours: 0, minutes: 0, totalHours: 0 };
  
  const start = new Date(admissionDate).getTime();
  if (isNaN(start)) return { days: 0, hours: 0, minutes: 0, totalHours: 0 };

  const diffMs = Math.max(0, now - start);
  
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  
  return { days, hours, minutes, totalHours };
};

export const getAutoPriority = (entryDateHospital: string, now: number = Date.now()): PatientPriority => {
  const { days } = calculateStay(entryDateHospital, now);
  if (days < 5) return PatientPriority.GREEN;
  if (days < 10) return PatientPriority.YELLOW;
  return PatientPriority.RED;
};

export const getStats = (patients: Patient[], unit: HospitalUnit, movements: PatientMovement[] = [], startDate?: string, endDate?: string): DashboardStats => {
  const start = startDate ? new Date(startDate + 'T00:00:00').toISOString() : new Date().toISOString();
  const end = endDate ? new Date(endDate + 'T23:59:59').toISOString() : new Date().toISOString();

  const unitPatients = patients.filter(p => p.unitId === unit.id);
  const activePatients = unitPatients.filter(p => 
    [PatientStatus.ADMITTED, PatientStatus.STABILIZATION, PatientStatus.ISOLATION].includes(p.status)
  );

  let totalDaysGlobal = 0;
  let vermelhos = 0;
  let amarelos = 0;
  let verdes = 0;

  const now = Date.now();
  activePatients.forEach(p => {
    const stay = calculateStay(p.entryDateHospital, now);
    totalDaysGlobal += stay.days;
    
    if (stay.days < 5) verdes++;
    else if (stay.days < 10) amarelos++;
    else vermelhos++;
  });
  
  const unitName = unit.name;
  const unitMovements = movements.filter(m => {
    const isWithinRange = m.date >= start && m.date <= end;
    return isWithinRange && (m.fromUnit === unitName || m.toUnit === unitName);
  });

  return {
    totalLeitos: unit.capacity,
    ocupados: activePatients.length,
    internacao: activePatients.filter(p => p.status === PatientStatus.ADMITTED).length,
    extras: activePatients.filter(p => p.isExtra).length,
    leitoDia: unit.capacity,
    estabilizacao: activePatients.filter(p => p.status === PatientStatus.STABILIZATION).length,
    isolamento: activePatients.filter(p => p.status === PatientStatus.ISOLATION).length,
    bloqueados: unitPatients.filter(p => p.status === PatientStatus.BLOCKED).length,
    obito: unitMovements.filter(m => m.type === MovementType.DECEASED).length,
    evasao: unitMovements.filter(m => m.type === MovementType.EVASION).length,
    alta: unitMovements.filter(m => m.type === MovementType.DISCHARGE).length,
    transferenciaInterna: unitMovements.filter(m => m.type === MovementType.TRANSFER && m.fromUnit === unitName).length,
    transferenciaExterna: unitMovements.filter(m => m.type === MovementType.EXTERNAL_TRANSFER).length,
    taxaOcupacao: unit.capacity > 0 ? (activePatients.length / unit.capacity) * 100 : 0,
    tempoPermanencia: activePatients.length > 0 ? totalDaysGlobal / activePatients.length : 0,
    diasInternacaoTotal: totalDaysGlobal,
    vermelhos,
    amarelos,
    verdes
  };
};

export const getGlobalStats = (patients: Patient[], units: HospitalUnit[], movements: PatientMovement[] = [], startDate?: string, endDate?: string): DashboardStats => {
  const start = startDate ? new Date(startDate + 'T00:00:00').toISOString() : new Date().toISOString();
  const end = endDate ? new Date(endDate + 'T23:59:59').toISOString() : new Date().toISOString();

  const activePatients = patients.filter(p => 
    [PatientStatus.ADMITTED, PatientStatus.STABILIZATION, PatientStatus.ISOLATION].includes(p.status)
  );

  const totalLeitos = units.reduce((acc, u) => acc + u.capacity, 0);
  
  let totalDaysGlobal = 0;
  let vermelhos = 0;
  let amarelos = 0;
  let verdes = 0;

  const now = Date.now();
  activePatients.forEach(p => {
    const stay = calculateStay(p.entryDateHospital, now);
    totalDaysGlobal += stay.days;
    
    if (stay.days < 5) verdes++;
    else if (stay.days < 10) amarelos++;
    else vermelhos++;
  });
  
  const dayMovements = movements.filter(m => m.date >= start && m.date <= end);

  return {
    totalLeitos: totalLeitos,
    ocupados: activePatients.length,
    internacao: activePatients.filter(p => p.status === PatientStatus.ADMITTED).length,
    extras: activePatients.filter(p => p.isExtra).length,
    leitoDia: totalLeitos,
    estabilizacao: activePatients.filter(p => p.status === PatientStatus.STABILIZATION).length,
    isolamento: activePatients.filter(p => p.status === PatientStatus.ISOLATION).length,
    bloqueados: patients.filter(p => p.status === PatientStatus.BLOCKED).length,
    obito: dayMovements.filter(m => m.type === MovementType.DECEASED).length,
    evasao: dayMovements.filter(m => m.type === MovementType.EVASION).length,
    alta: dayMovements.filter(m => m.type === MovementType.DISCHARGE).length,
    transferenciaInterna: dayMovements.filter(m => m.type === MovementType.TRANSFER).length,
    transferenciaExterna: dayMovements.filter(m => m.type === MovementType.EXTERNAL_TRANSFER).length,
    taxaOcupacao: totalLeitos > 0 ? (activePatients.length / totalLeitos) * 100 : 0,
    tempoPermanencia: activePatients.length > 0 ? totalDaysGlobal / activePatients.length : 0,
    diasInternacaoTotal: totalDaysGlobal,
    vermelhos,
    amarelos,
    verdes
  };
};
