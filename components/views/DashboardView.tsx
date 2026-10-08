
import React from 'react';
import { DashboardStats, Patient, HospitalUnit, PatientMovement } from '../../types';
import Dashboard from '../Dashboard';

interface Props {
  stats: DashboardStats;
  dates: { start: string, end: string };
  onDateChange: (type: 'start' | 'end', val: string) => void;
  patients: Patient[];
  units: HospitalUnit[];
  movements: PatientMovement[];
  currentUnitId: string;
  onEditPatient: (patient: Patient) => void;
  onOpenDossier: (patientId: string) => void;
}

const DashboardView: React.FC<Props> = ({ 
  stats, 
  dates, 
  onDateChange,
  patients,
  units,
  movements,
  currentUnitId,
  onEditPatient,
  onOpenDossier
}) => (
  <Dashboard 
    stats={stats} 
    startDate={dates.start} 
    endDate={dates.end} 
    onStartDateChange={(s) => onDateChange('start', s)} 
    onEndDateChange={(e) => onDateChange('end', e)}
    patients={patients}
    units={units}
    movements={movements}
    currentUnitId={currentUnitId}
    onEditPatient={onEditPatient}
    onOpenDossier={onOpenDossier}
  />
);

export default DashboardView;
