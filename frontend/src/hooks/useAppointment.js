import { useAsync } from './useAsync';
import { appointmentService } from '../services/appointmentService';

export function useAppointment(id) {
  return useAsync(() => appointmentService.getById(id), [id]);
}
