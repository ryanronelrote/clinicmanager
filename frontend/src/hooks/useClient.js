import { useAsync } from './useAsync';
import { clientService } from '../services/clientService';

export function useClient(id) {
  return useAsync(() => clientService.getById(id), [id]);
}
