
import { Patient, DashboardStats, PatientStatus, PatientPriority, HospitalUnit, PatientMovement, MovementType, DischargePrediction } from '../types';

export interface StayDuration {
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
}

export interface DischargePredictionStatus {
  hasPrediction: boolean;
  predictedDate?: string;
  daysRemaining: number; // >0: dias restantes, 0: hoje, <0: dias de atraso
  status: 'DELAYED' | 'TODAY' | 'APPROACHING' | 'ON_TRACK' | 'NONE';
  formattedDate?: string;
  totalPredictionsCount: number;
  isRecalculated: boolean;
  history: DischargePrediction[];
  lastReason?: string;
  previousDate?: string;
}

export const getDischargePredictionStatus = (patient: Patient, nowMs: number = Date.now()): DischargePredictionStatus => {
  const predicted = patient.predictedDischargeDate;
  const history = patient.dischargePredictions || [];
  const count = history.length;
  const isRecalculated = count > 1;
  const lastItem = history[history.length - 1];
  const lastReason = lastItem?.reason;
  const previousDate = lastItem?.previousDate || (history.length >= 2 ? history[history.length - 2].predictedDate : undefined);

  if (!predicted) {
    return {
      hasPrediction: false,
      daysRemaining: 0,
      status: 'NONE',
      totalPredictionsCount: count,
      isRecalculated,
      history,
      lastReason,
      previousDate
    };
  }

  // Normalizar datas (ignorar horas) para cálculo exato de dias
  const nowDate = new Date(nowMs);
  nowDate.setHours(0, 0, 0, 0);

  const parts = predicted.split('-');
  const py = parseInt(parts[0], 10);
  const pm = parseInt(parts[1], 10) - 1;
  const pd = parseInt(parts[2], 10);
  const targetDate = new Date(py, pm, pd);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - nowDate.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let status: 'DELAYED' | 'TODAY' | 'APPROACHING' | 'ON_TRACK';
  if (daysRemaining < 0) {
    status = 'DELAYED';
  } else if (daysRemaining === 0) {
    status = 'TODAY';
  } else if (daysRemaining <= 2) {
    status = 'APPROACHING';
  } else {
    status = 'ON_TRACK';
  }

  const formattedDate = targetDate.toLocaleDateString('pt-BR');

  return {
    hasPrediction: true,
    predictedDate: predicted,
    daysRemaining,
    status,
    formattedDate,
    totalPredictionsCount: count,
    isRecalculated,
    history,
    lastReason,
    previousDate
  };
};

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

  let altasPrevistasHoje = 0;
  let altasPrevistasProximosDias = 0;
  let altasAtrasadas = 0;

  const now = Date.now();
  activePatients.forEach(p => {
    const stay = calculateStay(p.entryDateHospital, now);
    totalDaysGlobal += stay.days;
    
    if (stay.days < 5) verdes++;
    else if (stay.days < 10) amarelos++;
    else vermelhos++;

    if (p.predictedDischargeDate) {
      const predStatus = getDischargePredictionStatus(p, now);
      if (predStatus.status === 'TODAY') altasPrevistasHoje++;
      else if (predStatus.status === 'DELAYED') altasAtrasadas++;
      else if (predStatus.daysRemaining > 0) altasPrevistasProximosDias++;
    }
  });
  
  const unitName = unit.name;
  const unitMovements = movements.filter(m => {
    const isWithinRange = m.date >= start && m.date <= end;
    return isWithinRange && (m.fromUnit === unitName || m.toUnit === unitName);
  });

  // Cálculo da Taxa de Assertividade da Previsão de Alta (apenas altas concluídas no prazo ou antes, excluídos óbitos)
  let totalAltasComPrevisao = 0;
  let altasAssertivasNoPrazo = 0;
  const processedDischargePatientIds = new Set<string>();

  const dischargeMovements = unitMovements.filter(m => m.type === MovementType.DISCHARGE);
  dischargeMovements.forEach(m => {
    processedDischargePatientIds.add(m.patientId);
    const patientObj = patients.find(p => p.id === m.patientId);
    const predicted = patientObj?.predictedDischargeDate || 
      (patientObj?.dischargePredictions && patientObj.dischargePredictions.length > 0 
        ? patientObj.dischargePredictions[patientObj.dischargePredictions.length - 1].predictedDate 
        : undefined);

    if (predicted) {
      totalAltasComPrevisao++;
      const [py, pm, pd] = predicted.split('-').map(Number);
      const targetDate = new Date(py, pm - 1, pd, 23, 59, 59).getTime();
      const actualDischarge = new Date(m.date).getTime();
      if (actualDischarge <= targetDate) {
        altasAssertivasNoPrazo++;
      }
    }
  });

  // Checagem complementar para pacientes desospitalizados registrados
  unitPatients.forEach(p => {
    if (p.status === PatientStatus.DISCHARGED && p.dischargeDate && !processedDischargePatientIds.has(p.id)) {
      const isWithinRange = p.dischargeDate >= start && p.dischargeDate <= end;
      if (isWithinRange) {
        const predicted = p.predictedDischargeDate || 
          (p.dischargePredictions && p.dischargePredictions.length > 0 
            ? p.dischargePredictions[p.dischargePredictions.length - 1].predictedDate 
            : undefined);

        if (predicted) {
          totalAltasComPrevisao++;
          const [py, pm, pd] = predicted.split('-').map(Number);
          const targetDate = new Date(py, pm - 1, pd, 23, 59, 59).getTime();
          const actualDischarge = new Date(p.dischargeDate).getTime();
          if (actualDischarge <= targetDate) {
            altasAssertivasNoPrazo++;
          }
        }
      }
    }
  });

  const taxaAssertividadeAlta = totalAltasComPrevisao > 0 
    ? (altasAssertivasNoPrazo / totalAltasComPrevisao) * 100 
    : 100;

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
    verdes,
    altasPrevistasHoje,
    altasPrevistasProximosDias,
    altasAtrasadas,
    taxaAssertividadeAlta,
    totalAltasComPrevisao,
    altasAssertivasNoPrazo
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

  let altasPrevistasHoje = 0;
  let altasPrevistasProximosDias = 0;
  let altasAtrasadas = 0;

  const now = Date.now();
  activePatients.forEach(p => {
    const stay = calculateStay(p.entryDateHospital, now);
    totalDaysGlobal += stay.days;
    
    if (stay.days < 5) verdes++;
    else if (stay.days < 10) amarelos++;
    else vermelhos++;

    if (p.predictedDischargeDate) {
      const predStatus = getDischargePredictionStatus(p, now);
      if (predStatus.status === 'TODAY') altasPrevistasHoje++;
      else if (predStatus.status === 'DELAYED') altasAtrasadas++;
      else if (predStatus.daysRemaining > 0) altasPrevistasProximosDias++;
    }
  });
  
  const dayMovements = movements.filter(m => m.date >= start && m.date <= end);

  // Cálculo da Taxa de Assertividade da Previsão de Alta (apenas altas concluídas no prazo ou antes, excluídos óbitos)
  let totalAltasComPrevisao = 0;
  let altasAssertivasNoPrazo = 0;
  const processedDischargePatientIds = new Set<string>();

  const dischargeMovements = dayMovements.filter(m => m.type === MovementType.DISCHARGE);
  dischargeMovements.forEach(m => {
    processedDischargePatientIds.add(m.patientId);
    const patientObj = patients.find(p => p.id === m.patientId);
    const predicted = patientObj?.predictedDischargeDate || 
      (patientObj?.dischargePredictions && patientObj.dischargePredictions.length > 0 
        ? patientObj.dischargePredictions[patientObj.dischargePredictions.length - 1].predictedDate 
        : undefined);

    if (predicted) {
      totalAltasComPrevisao++;
      const [py, pm, pd] = predicted.split('-').map(Number);
      const targetDate = new Date(py, pm - 1, pd, 23, 59, 59).getTime();
      const actualDischarge = new Date(m.date).getTime();
      if (actualDischarge <= targetDate) {
        altasAssertivasNoPrazo++;
      }
    }
  });

  // Checagem complementar para pacientes desospitalizados registrados
  patients.forEach(p => {
    if (p.status === PatientStatus.DISCHARGED && p.dischargeDate && !processedDischargePatientIds.has(p.id)) {
      const isWithinRange = p.dischargeDate >= start && p.dischargeDate <= end;
      if (isWithinRange) {
        const predicted = p.predictedDischargeDate || 
          (p.dischargePredictions && p.dischargePredictions.length > 0 
            ? p.dischargePredictions[p.dischargePredictions.length - 1].predictedDate 
            : undefined);

        if (predicted) {
          totalAltasComPrevisao++;
          const [py, pm, pd] = predicted.split('-').map(Number);
          const targetDate = new Date(py, pm - 1, pd, 23, 59, 59).getTime();
          const actualDischarge = new Date(p.dischargeDate).getTime();
          if (actualDischarge <= targetDate) {
            altasAssertivasNoPrazo++;
          }
        }
      }
    }
  });

  const taxaAssertividadeAlta = totalAltasComPrevisao > 0 
    ? (altasAssertivasNoPrazo / totalAltasComPrevisao) * 100 
    : 100;

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
    verdes,
    altasPrevistasHoje,
    altasPrevistasProximosDias,
    altasAtrasadas,
    taxaAssertividadeAlta,
    totalAltasComPrevisao,
    altasAssertivasNoPrazo
  };
};
