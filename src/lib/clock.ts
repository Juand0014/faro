export function localHour(timezone: string, now = new Date()): number {
  try { return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(now)) % 24; }
  catch { return now.getUTCHours(); }
}
export function localTime(timezone: string, now = new Date()): string {
  try { return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone }).format(now); }
  catch { return '--:--'; }
}
export function dayStatus(timezone: string, now = new Date()): 'awake' | 'working' | 'asleep' {
  const h = localHour(timezone, now);
  if (h < 7 || h >= 23) return 'asleep';
  if (h >= 9 && h < 18) return 'working';
  return 'awake';
}
export const STATUS_ES: Record<string, string> = { awake: 'Despierto', working: 'En el día', asleep: 'Durmiendo', online: 'En línea', offline: 'Ausente' };
