import { useAsync } from './useAsync';
import { clientService } from '../services/clientService';

export function useClients() {
  return useAsync(() => clientService.getAll(), []);
}
