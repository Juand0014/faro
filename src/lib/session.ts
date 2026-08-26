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
  return raw || 'Error de autenticación';
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

export { tz } from './place';
