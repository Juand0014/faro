import { supabase } from './supabase';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BCECdW8yxTmtyyFMxL5GjtzlkIaKPu2IwnQyq6N30STX3eUV_27NuqGrDRM9trHwGrrI-0nDU4DJpdWpRO84DRo';

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

export async function showPingNotice(body = '💛 Está pensando en ti') {
  if (!canNotify() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Faro', {
    body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: 'faro-ping',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: './#/home' },
  } as NotificationOptions);
}

export async function enablePingNotices(me: { id: string; couple_id: string }) {
  if (!notifySupported()) return Notification.permission as NotificationPermission;
  const perm = await Notification.requestPermission();
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
  } catch { /* permission granted; push may still fail on some browsers */ }
  return perm;
}

export async function notifyPartner() {
  try { await supabase.functions.invoke('notify-ping'); } catch { /* local notice still works */ }
}
