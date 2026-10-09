import { LEVELS } from './levels';
export type Save = { best: number[]; sound: boolean; vibration: boolean };
export function loadSave(): Save {
  const fallback: Save = { best: Array(LEVELS.length).fill(0), sound: true, vibration: true };
  try {
    const value = JSON.parse(localStorage.getItem('breakgrid-v1') || 'null');
    if (!value || typeof value !== 'object') return fallback;
    return { best: Array.from({ length: LEVELS.length }, (_, i) => Number.isFinite(value.best?.[i]) ? Math.max(0, value.best[i]) : 0), sound: typeof value.sound === 'boolean' ? value.sound : true, vibration: typeof value.vibration === 'boolean' ? value.vibration : true };
  } catch { return fallback; }
}
export function persist(save: Save) { try { localStorage.setItem('breakgrid-v1', JSON.stringify(save)); } catch { /* Play remains available when storage is restricted. */ } }
export function recordBest(save: Save, level: number, score: number): Save { return { ...save, best: save.best.map((best, i) => i === level ? Math.max(best, score) : best) }; }
