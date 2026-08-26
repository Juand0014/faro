export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const TZ_CITY: Record<string, string> = {
  'America/Santo_Domingo': 'Santo Domingo',
  'America/Santiago': 'Santiago',
  'America/Argentina/Buenos_Aires': 'Buenos Aires',
  'America/Mexico_City': 'Ciudad de México',
  'America/Bogota': 'Bogotá',
  'America/Lima': 'Lima',
  'America/Caracas': 'Caracas',
  'America/La_Paz': 'La Paz',
  'America/Guayaquil': 'Guayaquil',
  'America/Asuncion': 'Asunción',
  'America/Montevideo': 'Montevideo',
  'America/Sao_Paulo': 'São Paulo',
  'America/Puerto_Rico': 'San Juan',
  'America/New_York': 'Nueva York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Los_Angeles': 'Los Ángeles',
  'America/Toronto': 'Toronto',
  'America/Panama': 'Ciudad de Panamá',
  'Europe/Madrid': 'Madrid',
  'Europe/Paris': 'París',
  'Europe/London': 'Londres',
  'Europe/Berlin': 'Berlín',
  'Europe/Rome': 'Roma',
  'UTC': 'UTC',
};

export function cityFromTimezone(timezone: string) {
  if (TZ_CITY[timezone]) return TZ_CITY[timezone];
  const last = timezone.split('/').pop() || timezone;
  return last.replace(/_/g, ' ');
}

export function prettyPlace(city: string | null | undefined, timezone: string | null | undefined) {
  if (city && city.trim()) return city.trim();
  if (timezone) return cityFromTimezone(timezone);
  return '—';
}

export async function detectPlace(): Promise<{ city: string; timezone: string }> {
  const timezone = tz();
  let city = cityFromTimezone(timezone);
  try {
    const r = await fetch('https://ipwho.is/?fields=success,city,timezone', {
      signal: AbortSignal.timeout(4000),
    });
    const j = await r.json();
    if (j?.success && typeof j.city === 'string' && j.city.trim()) city = j.city.trim();
  } catch { /* timezone fallback */ }
  return { city, timezone };
}
