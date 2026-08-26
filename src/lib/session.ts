import { detectPlace } from './place';
import { supabase } from './supabase';

export type Member = {
  id: string; couple_id: string; name: string; timezone: string;
  city: string | null; last_seen: string;
};

export function authErrorMessage(error: unknown): string {
  const raw = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error ?? '');
  if (/anonymous/i.test(raw) || raw.includes('anonymous_provider_disabled')) {
    return 'Falta activar Anonymous sign-ins en Supabase → Authentication → Providers.';
  }
  if (raw === 'no autenticado') {
    return 'No hay sesión. Recarga la página o activa Anonymous sign-ins en Supabase.';
  }
  if (raw === 'nombre_vacio') return 'Escribe tu nombre.';
  return raw || 'Error de autenticación';
}

const NAME_KEY = 'faro-name';

export function rememberName(name: string) {
  const trimmed = name.trim();
  if (trimmed) localStorage.setItem(NAME_KEY, trimmed);
}

export function rememberedName() {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export async function ensureAuth(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.user!.id;
}

export async function getMyMember(): Promise<Member | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from('members').select('*').eq('id', u.user.id).maybeSingle();
  return (data as Member) ?? null;
}

/** El asiento actual de la pareja. Cambia si ella entra desde otro aparato, así que nunca se cachea. */
export async function getPartnerId(coupleId: string, meId: string): Promise<string | null> {
  const { data } = await supabase.from('members')
    .select('id, last_seen').eq('couple_id', coupleId).neq('id', meId)
    .order('last_seen', { ascending: false }).limit(1);
  return (data as { id: string }[] | null)?.[0]?.id ?? null;
}

export async function getCoupleCode(coupleId: string): Promise<string | null> {
  const { data } = await supabase.from('couples').select('code').eq('id', coupleId).maybeSingle();
  return (data as { code?: string } | null)?.code ?? null;
}

export async function touchLastSeen() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const place = await detectPlace();
  await supabase.from('members').update({
    last_seen: new Date().toISOString(),
    city: place.city,
    timezone: place.timezone,
  }).eq('id', u.user.id);
}

/** Cierra la sesión de este aparato. El asiento sigue tuyo hasta que entres en el otro con el mismo nombre. */
export async function leaveThisDevice() {
  await supabase.auth.signOut();
  window.location.hash = '#/home';
  window.location.reload();
}

export { tz } from './place';
