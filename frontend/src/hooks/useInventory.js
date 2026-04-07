import { useAsync } from './useAsync';
import { inventoryService } from '../services/inventoryService';

export function useInventory() {
  return useAsync(() => inventoryService.getAll(), []);
}
