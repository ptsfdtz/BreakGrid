export type Save = { unlocked: number; best: number[]; sound: boolean; vibration: boolean };
export function loadSave(): Save {
  const fallback: Save = { unlocked: 1, best: Array(6).fill(0), sound: true, vibration: true };
  try {
    const value = JSON.parse(localStorage.getItem('breakgrid-v1') || 'null');
    if (!value || typeof value !== 'object') return fallback;
    return { unlocked: Number.isInteger(value.unlocked) ? Math.max(1, Math.min(6, value.unlocked)) : 1, best: Array.from({ length: 6 }, (_, i) => Number.isFinite(value.best?.[i]) ? Math.max(0, value.best[i]) : 0), sound: typeof value.sound === 'boolean' ? value.sound : true, vibration: typeof value.vibration === 'boolean' ? value.vibration : true };
  } catch { return fallback; }
}
export function persist(save: Save) { try { localStorage.setItem('breakgrid-v1', JSON.stringify(save)); } catch { /* Play remains available when storage is restricted. */ } }
export function completeLevel(save: Save, level: number, score: number): Save { return { ...save, unlocked: Math.max(save.unlocked, Math.min(6, level + 2)), best: save.best.map((best, i) => i === level ? Math.max(best, score) : best) }; }
