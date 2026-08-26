import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPub || !vapidPriv) return json({ error: 'vapid missing' }, 500);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return json({ error: 'no auth' }, 401);

  webpush.setVapidDetails('mailto:faro@users.noreply.github.com', vapidPub, vapidPriv);

  const { data: me } = await admin.from('members').select('couple_id,name').eq('id', user.id).maybeSingle();
  if (!me) return json({ error: 'no member' }, 400);

  const { data: subs } = await admin.from('push_subs')
    .select('endpoint,p256dh,auth')
    .eq('couple_id', me.couple_id)
    .neq('user_id', user.id);

  const payload = JSON.stringify({
    title: 'Faro',
    body: `${me.name || 'Tu pareja'} está pensando en ti 💛`,
  });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent += 1;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await admin.from('push_subs').delete().eq('endpoint', s.endpoint);
      }
    }
  }
  return json({ sent });
});
