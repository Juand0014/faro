import { supabase } from './supabase';

export type Member = {
  id: string; couple_id: string; name: string; timezone: string;
  city: string | null; last_seen: string;
};

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
  await supabase.from('members').update({ last_seen: new Date().toISOString() }).eq('id', u.user.id);
}

export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
