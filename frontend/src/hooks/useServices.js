import { useAsync } from './useAsync';
import { serviceService } from '../services/serviceService';

export function useServices() {
  return useAsync(() => serviceService.getAll(), []);
}
