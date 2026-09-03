import { supabase } from './supabase';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BCECdW8yxTmtyyFMxL5GjtzlkIaKPu2IwnQyq6N30STX3eUV_27NuqGrDRM9trHwGrrI-0nDU4DJpdWpRO84DRo';

const ICON = './icon-192.png';

export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function notifySupported() {
  if (!canNotify()) return false;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as { standalone?: boolean }).standalone);
  if (iOS && !standalone) return false;
  return true;
}

export function iOSNeedsInstall() {
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as { standalone?: boolean }).standalone);
  return iOS && !standalone && 'serviceWorker' in navigator;
}

function toBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function noticeOptions(body: string, tag: string, url = './#/home'): NotificationOptions {
  return {
    body,
    icon: ICON,
    badge: ICON,
    tag,
    renotify: true,
    data: { url },
  } as NotificationOptions;
}

export function pingCopy(name?: string | null) {
  const who = (name || '').trim() || 'Tu pareja';
  return { title: 'Desde faro', body: `${who} piensa en ti` };
}

export async function showPingNotice(body: string, tag = 'faro-ping', title = 'Desde faro', url = './#/home') {
  if (!canNotify() || Notification.permission !== 'granted') return false;
  const opts = noticeOptions(body, tag, url);
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sw')), 2500)),
    ]);
    await reg.showNotification(title, opts);
    return true;
  } catch {
    try {
      new Notification(title, { body, icon: ICON, tag });
      return true;
    } catch {
      return false;
    }
  }
}

export async function enablePingNotices(me: { id: string; couple_id: string }) {
  if (!canNotify()) return 'denied' as NotificationPermission;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(VAPID),
      });
    }
    const json = sub.toJSON();
    if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
      await supabase.from('push_subs').upsert({
        endpoint: json.endpoint,
        user_id: me.id,
        couple_id: me.couple_id,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
    }
  } catch { /* el aviso local igual funciona si el teléfono dio permiso */ }
  return perm;
}

export type PushResult = {
  ok: boolean;
  sent: number;
  total: number;
  reason: 'ok' | 'sin-aparato' | 'servidor' | 'red';
};

async function sendPush(body?: { type: 'chat'; text: string }): Promise<PushResult> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-ping', body ? { body } : {});
    if (error) {
      console.warn('faro: el servidor de avisos respondió con error', error);
      return { ok: false, sent: 0, total: 0, reason: 'servidor' };
    }
    const sent = Number((data as { sent?: unknown })?.sent ?? 0);
    const total = Number((data as { total?: unknown })?.total ?? 0);
    if (!total) {
      console.warn('faro: tu pareja no tiene ningún aparato registrado para avisos');
      return { ok: false, sent: 0, total: 0, reason: 'sin-aparato' };
    }
    if (!sent) {
      console.warn('faro: el servicio de push rechazó el aviso', data);
      return { ok: false, sent, total, reason: 'servidor' };
    }
    return { ok: true, sent, total, reason: 'ok' };
  } catch (err) {
    console.warn('faro: no se pudo contactar el servidor de avisos', err);
    return { ok: false, sent: 0, total: 0, reason: 'red' };
  }
}

export function notifyPartner() {
  return sendPush();
}

export function notifyChat(text: string) {
  const body = text.trim().slice(0, 280);
  if (!body) return Promise.resolve<PushResult>({ ok: false, sent: 0, total: 0, reason: 'red' });
  return sendPush({ type: 'chat', text: body });
}
