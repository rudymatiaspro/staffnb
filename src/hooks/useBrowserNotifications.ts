import { useState, useCallback, useEffect } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface BrowserNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string; // deduplicates notifications with same tag
}

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission as NotificationPermission;
  });

  const isSupported = typeof Notification !== 'undefined';

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied' as NotificationPermission;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result as NotificationPermission;
    } catch {
      return 'denied' as NotificationPermission;
    }
  }, [isSupported]);

  const notify = useCallback(
    ({ title, body, icon, tag }: BrowserNotificationOptions) => {
      if (!isSupported || Notification.permission !== 'granted') return;
      try {
        const n = new Notification(title, {
          body,
          icon: icon ?? '/favicon.ico',
          tag,
          requireInteraction: false,
        });
        // Auto-close after 6s
        setTimeout(() => n.close(), 6000);
      } catch {
        // Firefox private mode can throw even with permission
      }
    },
    [isSupported]
  );

  // Keep permission state in sync if changed externally (e.g. browser settings)
  useEffect(() => {
    if (!isSupported) return;
    const interval = setInterval(() => {
      const current = Notification.permission as NotificationPermission;
      setPermission((prev) => (prev !== current ? current : prev));
    }, 5000);
    return () => clearInterval(interval);
  }, [isSupported]);

  return { permission, isSupported, requestPermission, notify };
}
