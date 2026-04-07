import { useAsync } from './useAsync';
import { appointmentService } from '../services/appointmentService';

export function useAppointmentsByWeek(weekStart) {
  return useAsync(() => appointmentService.getByWeek(weekStart), [weekStart]);
}

export function useAppointmentsByMonth(monthStr) {
  return useAsync(() => appointmentService.getByMonth(monthStr), [monthStr]);
}

export function useAppointmentsByClient(clientId) {
  return useAsync(() => appointmentService.getByClient(clientId), [clientId]);
}
