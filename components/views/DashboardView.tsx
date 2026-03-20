
import React from 'react';
import { DashboardStats } from '../../types';
import Dashboard from '../Dashboard';

interface Props {
  stats: DashboardStats;
  dates: { start: string, end: string };
  onDateChange: (type: 'start' | 'end', val: string) => void;
}

const DashboardView: React.FC<Props> = ({ stats, dates, onDateChange }) => (
  <Dashboard 
    stats={stats} 
    startDate={dates.start} 
    endDate={dates.end} 
    onStartDateChange={(s) => onDateChange('start', s)} 
    onEndDateChange={(e) => onDateChange('end', e)} 
  />
);

export default DashboardView;
