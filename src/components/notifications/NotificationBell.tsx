import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Bell, Check, X, MessageSquare, AlertTriangle, Calendar, Flag } from 'lucide-react';

interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  refId: string | null;
  refType: string | null;
  createdAt: Date;
}

export function NotificationBell() {
  const { currentUser } = useApp();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifs = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications((data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      title: r.title,
      body: r.body,
      read: r.read,
      refId: r.ref_id,
      refType: r.ref_type,
      createdAt: new Date(r.created_at),
    })));
  }, [currentUser]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Realtime
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel(`notifs-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const r = payload.new as Record<string, unknown>;
        setNotifications(prev => [{
          id: r.id as string,
          userId: r.user_id as string,
          type: r.type as string,
          title: r.title as string,
          body: r.body as string,
          read: false,
          refId: (r.ref_id as string) ?? null,
          refType: (r.ref_type as string) ?? null,
          createdAt: new Date(r.created_at as string),
        }, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const markAllRead = async () => {
    if (!currentUser) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    if (type === 'mention') return <MessageSquare className="w-3.5 h-3.5 text-primary" />;
    if (type === 'malus') return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    if (type === 'swap') return <Calendar className="w-3.5 h-3.5 text-timer-warning" />;
    if (type === 'incident') return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    if (type === 'contest') return <Flag className="w-3.5 h-3.5 text-amber-400" />;
    return <Bell className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  if (!currentUser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl border border-border shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune notification</p>
              )}
              {notifications.map(n => (
                <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border/30 last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {n.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
