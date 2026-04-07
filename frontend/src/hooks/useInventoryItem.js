import { useAsync } from './useAsync';
import { inventoryService } from '../services/inventoryService';

export function useInventoryItem(id) {
  return useAsync(async () => {
    const [item, movements] = await Promise.all([
      inventoryService.getById(id),
      inventoryService.getMovements(id),
    ]);
    return { item, movements };
  }, [id]);
}
