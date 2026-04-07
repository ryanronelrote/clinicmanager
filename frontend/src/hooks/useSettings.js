import { useAsync } from './useAsync';
import { settingsService } from '../services/settingsService';

export function useSettings() {
  return useAsync(() => settingsService.getAll(), []);
}
