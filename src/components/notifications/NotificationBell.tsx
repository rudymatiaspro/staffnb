import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Bell, Check, MessageSquare, AlertTriangle, Calendar, Flag, Package, Thermometer, Trophy, ClipboardList } from 'lucide-react';

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

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function getIcon(type: string) {
  switch (type) {
    case 'task':         return <ClipboardList className="w-3.5 h-3.5 text-primary" />;
    case 'order':        return <Package className="w-3.5 h-3.5 text-amber-500" />;
    case 'haccp':        return <Thermometer className="w-3.5 h-3.5 text-blue-500" />;
    case 'planning':     return <Calendar className="w-3.5 h-3.5 text-indigo-500" />;
    case 'achievement':  return <Trophy className="w-3.5 h-3.5 text-yellow-500" />;
    case 'alert':        return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    case 'mention':      return <MessageSquare className="w-3.5 h-3.5 text-primary" />;
    case 'malus':        return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    case 'swap':         return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
    case 'incident':     return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    case 'contest':      return <Flag className="w-3.5 h-3.5 text-amber-400" />;
    case 'menu_alert':   return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    default:             return <Bell className="w-3.5 h-3.5 text-muted-foreground" />;
  }
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
      .limit(40);
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

  // Realtime subscription
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
        }, ...prev.slice(0, 39)]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const markAllRead = async () => {
    if (!currentUser) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  if (!currentUser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl border border-border shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                Notifications {unreadCount > 0 && <span className="text-xs text-muted-foreground">({unreadCount} non lues)</span>}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Check className="w-3 h-3" /> Tout marquer lu
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Bell className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Aucune notification</p>
                </div>
              )}
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
                  className={`w-full flex gap-3 px-4 py-3 border-b border-border/30 last:border-0 text-left transition-colors hover:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
