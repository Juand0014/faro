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

function zonedParts(timezone: string, now: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute };
}

function instantAtLocal(timezone: string, year: number, month: number, day: number, hour: number) {
  let guess = Date.UTC(year, month - 1, day, hour);
  for (let i = 0; i < 4; i++) {
    const shown = zonedParts(timezone, new Date(guess));
    const delta = Date.UTC(year, month - 1, day, hour)
      - Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    guess += delta;
    if (delta === 0) break;
  }
  return new Date(guess);
}

/** Últimas 23:00 en esa zona: a partir de ahí Faro considera que es de noche. */
export function lastNightReset(timezone: string, now = new Date()): Date {
  const p = zonedParts(timezone, now);
  if (p.hour >= 23) return instantAtLocal(timezone, p.year, p.month, p.day, 23);
  const prev = new Date(Date.UTC(p.year, p.month - 1, p.day, 12) - 36 * 3600 * 1000);
  const y = zonedParts(timezone, prev);
  return instantAtLocal(timezone, y.year, y.month, y.day, 23);
}

/** El chat se borra en cuanto llega la primera noche de la pareja (23:00 local). */
export function chatCutoff(timezones: string[], now = new Date()): Date {
  const zones = timezones.filter(Boolean);
  if (!zones.length) return lastNightReset('UTC', now);
  return new Date(Math.max(...zones.map((tz) => lastNightReset(tz, now).getTime())));
}
