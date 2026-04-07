import { useState, useEffect } from 'react';
import { appointmentService } from '../services/appointmentService';

export function useConflictCheck(date, startTime, duration, excludeId) {
  const [conflicts, setConflicts] = useState(null);

  useEffect(() => {
    if (!date || !startTime || !duration) { setConflicts(null); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await appointmentService.checkConflicts(date, startTime, duration, excludeId);
        setConflicts(data);
      } catch {
        setConflicts(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [date, startTime, duration, excludeId]);

  return conflicts;
}
