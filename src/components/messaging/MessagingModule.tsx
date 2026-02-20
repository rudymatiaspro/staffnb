import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import {
  Send, Hash, Users, Wine, ChefHat, Layers, PersonStanding,
  Settings, AtSign, Trash2, MessageSquare, Pin, AlertTriangle,
  Megaphone, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType = 'user' | 'system' | 'incident' | 'annonce';

interface Message {
  id: string;
  channel: string;
  content: string;
  senderId: string;
  senderName: string;
  senderTeam: string;
  mentions: string[];
  createdAt: Date;
  msgType: MessageType;
}

// ─── Channels config ──────────────────────────────────────────────────────────

const CHANNELS = [
  { id: 'general',    label: 'général',    icon: <Hash className="w-3.5 h-3.5" /> },
  { id: 'annonces',   label: 'annonces',   icon: <Megaphone className="w-3.5 h-3.5" /> },
  { id: 'bar',        label: 'bar',        icon: <Wine className="w-3.5 h-3.5" /> },
  { id: 'kitchen',    label: 'cuisine',    icon: <ChefHat className="w-3.5 h-3.5" /> },
  { id: 'patisserie', label: 'pâtisserie', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'restaurant', label: 'restaurant', icon: <PersonStanding className="w-3.5 h-3.5" /> },
  { id: 'managers',   label: 'managers',   icon: <Settings className="w-3.5 h-3.5" /> },
];

// Roles that can WRITE in #annonces
const ANNONCE_WRITERS = ['owner', 'admin', 'manager', 'god'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function mapRow(r: Record<string, unknown>): Message {
  return {
    id: r.id as string,
    channel: r.channel as string,
    content: r.content as string,
    senderId: r.sender_id as string,
    senderName: r.sender_name as string,
    senderTeam: r.sender_team as string,
    mentions: (r.mentions as string[]) ?? [],
    createdAt: new Date(r.created_at as string),
    msgType: (r.msg_type as MessageType) ?? 'user',
  };
}

// ─── Message renderers ────────────────────────────────────────────────────────

/** Annonce (pinned announcement) card */
function AnnonceCard({
  msg, canDelete, onDelete, users,
}: {
  msg: Message; canDelete: boolean; onDelete: () => void; users: { id: string; name: string }[];
}) {
  return (
    <div className="group relative rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2 my-2">
      {/* Pin badge */}
      <div className="flex items-start gap-2">
        <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground break-words leading-snug">
            {msg.content.split(/(@\w+)/).map((part, i) =>
              part.startsWith('@')
                ? <span key={i} className="text-primary font-semibold">{part}</span>
                : <span key={i}>{part}</span>
            )}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 pl-5">
        <span className="text-[11px] font-semibold text-primary">{msg.senderName}</span>
        <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
}

/** Incident auto-message */
function IncidentCard({ msg, canDelete, onDelete }: { msg: Message; canDelete: boolean; onDelete: () => void }) {
  // Parse structured incident payload if JSON, else show plain text
  let incidentData: { title?: string; severity?: string; reporter?: string; id?: string; time?: string } | null = null;
  try {
    incidentData = JSON.parse(msg.content);
  } catch {
    incidentData = null;
  }

  const severityColor: Record<string, string> = {
    critical: 'border-destructive/60 bg-destructive/5',
    high:     'border-orange-500/40 bg-orange-500/5',
    medium:   'border-amber-500/40 bg-amber-500/5',
    low:      'border-border bg-muted/30',
  };

  const severityLabel: Record<string, string> = {
    critical: '🚨 Critique', high: '⚠️ Grave', medium: '⚡ Moyen', low: 'ℹ️ Info',
  };

  const sev = incidentData?.severity ?? 'medium';
  const colorCls = severityColor[sev] ?? severityColor.medium;

  return (
    <div className={`group relative rounded-xl border p-3.5 my-2 ${colorCls}`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-[hsl(var(--timer-warning))] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          {incidentData ? (
            <>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                INCIDENT — {severityLabel[sev] ?? sev}
              </p>
              <p className="text-sm font-bold text-foreground">{incidentData.title ?? 'Incident signalé'}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Signalé par <span className="font-semibold">{incidentData.reporter ?? 'inconnu'}</span></span>
                <span>·</span>
                <span>{incidentData.time ?? formatTime(msg.createdAt)}</span>
              </div>
              {incidentData.id && (
                <a
                  href={`/incidents/${incidentData.id}`}
                  className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Voir le ticket
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground break-words">{msg.content}</p>
          )}
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** System message (centered, minimal) */
function SystemMsg({ msg }: { msg: Message }) {
  return (
    <div className="flex items-center gap-2 my-2 px-2">
      <div className="flex-1 h-px bg-border/50" />
      <p className="text-[10px] text-muted-foreground/70 px-2 text-center max-w-xs">{msg.content}</p>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MessagingModuleProps {
  canManageAll?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MessagingModule({ canManageAll = false }: MessagingModuleProps) {
  const { currentUser, users } = useApp();
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userRole = currentUser?.role as string | undefined;

  // ── Channel visibility ────────────────────────────────────────────────────
  const availableChannels = CHANNELS.filter(ch => {
    if (ch.id === 'managers') return canManageAll || ['manager', 'owner', 'admin', 'chef', 'god'].includes(userRole ?? '');
    return true;
  });

  // Can the current user WRITE in the active channel?
  const canWriteInChannel = (() => {
    if (activeChannel === 'annonces') {
      return ANNONCE_WRITERS.includes(userRole ?? '');
    }
    return true; // all other channels: everyone can write
  })();

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (channel: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(100);
    if (!error && data) {
      setMessages((data as Record<string, unknown>[]).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMessages(activeChannel); }, [activeChannel, fetchMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = supabase
      .channel('messages-realtime-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = mapRow(payload.new as Record<string, unknown>);
        if (newMsg.channel === activeChannel) {
          setMessages(prev => [...prev, newMsg]);
        } else {
          setUnreadCounts(prev => ({ ...prev, [newMsg.channel]: (prev[newMsg.channel] ?? 0) + 1 }));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChannel]);

  // ── Channel switch ────────────────────────────────────────────────────────
  const handleChannelChange = (ch: string) => {
    setActiveChannel(ch);
    setUnreadCounts(prev => ({ ...prev, [ch]: 0 }));
  };

  // ── Mention detection ─────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
      setMentionStart(cursorPos - mentionMatch[0].length);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
      setMentionStart(-1);
    }
  };

  const insertMention = (user: { id: string; name: string }) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(input.indexOf(' ', mentionStart) !== -1 ? input.indexOf(' ', mentionStart) : input.length);
    setInput(`${before}@${user.name} ${after}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const [sendError, setSendError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || !currentUser || !canWriteInChannel) return;
    setSendError(null);

    // Verify auth session before sending
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSendError("Session expirée — veuillez vous reconnecter.");
      return;
    }

    const mentionedNames = [...input.matchAll(/@(\w+)/g)].map(m => m[1].toLowerCase());
    const mentionedIds = users
      .filter(u => mentionedNames.includes(u.name.toLowerCase()))
      .map(u => u.id);

    const msgType: MessageType = activeChannel === 'annonces' ? 'annonce' : 'user';

    const { error } = await supabase.from('messages').insert({
      channel: activeChannel,
      content: input.trim(),
      sender_id: session.user.id,   // use auth session uid directly
      sender_name: currentUser.name,
      sender_team: currentUser.team,
      mentions: mentionedIds,
      msg_type: msgType,
    });
    if (!error) {
      setInput('');
      setShowMentions(false);
    } else {
      console.error('Message send error:', error);
      setSendError(`Erreur : ${error.message}`);
    }
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('messages').delete().eq('id', msgId);
  };

  // ── Mention suggestions ───────────────────────────────────────────────────
  const filteredMentionUsers = mentionQuery
    ? users.filter(u => u.name.toLowerCase().startsWith(mentionQuery) && u.id !== currentUser?.id)
    : users.filter(u => u.id !== currentUser?.id).slice(0, 6);

  // ── Group by date ─────────────────────────────────────────────────────────
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const dateStr = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (!last || last.date !== dateStr) {
      groupedMessages.push({ date: dateStr, msgs: [msg] });
    } else {
      last.msgs.push(msg);
    }
  }

  const isAnnouncesChannel = activeChannel === 'annonces';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] gap-0">

      {/* Channel selector */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl overflow-x-auto mb-3 flex-shrink-0">
        {availableChannels.map(ch => (
          <button
            key={ch.id}
            onClick={() => handleChannelChange(ch.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
              activeChannel === ch.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {ch.icon}
            <span className="hidden sm:inline">#{ch.label}</span>
            {(unreadCounts[ch.id] ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {unreadCounts[ch.id] > 9 ? '9+' : unreadCounts[ch.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Annonces banner */}
      {isAnnouncesChannel && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20 mb-3 flex-shrink-0">
          <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs text-primary font-medium flex-1">
            Canal d'annonces officiel
            {!canWriteInChannel && ' — Lecture seule'}
          </p>
          {canWriteInChannel && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">✏️ Éditeur</span>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto glass-card rounded-2xl p-4 space-y-0.5 border border-border">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Chargement…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            {isAnnouncesChannel
              ? <><Pin className="w-10 h-10 opacity-20" /><p className="text-sm">Aucune annonce pour l'instant</p></>
              : <><MessageSquare className="w-10 h-10 opacity-20" /><p className="text-sm">Aucun message dans #{CHANNELS.find(c => c.id === activeChannel)?.label}</p></>
            }
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground px-2">{group.date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.msgs.map((msg, idx) => {
                const isOwn = msg.senderId === currentUser?.id;
                const canDel = isOwn || canManageAll;

                // ── Special message types ──────────────────────────────────
                if (msg.msgType === 'incident') {
                  return (
                    <IncidentCard
                      key={msg.id}
                      msg={msg}
                      canDelete={canDel}
                      onDelete={() => deleteMessage(msg.id)}
                    />
                  );
                }

                if (msg.msgType === 'annonce') {
                  return (
                    <AnnonceCard
                      key={msg.id}
                      msg={msg}
                      canDelete={canDel}
                      onDelete={() => deleteMessage(msg.id)}
                      users={users}
                    />
                  );
                }

                if (msg.msgType === 'system') {
                  return <SystemMsg key={msg.id} msg={msg} />;
                }

                // ── Regular user message ───────────────────────────────────
                const prevMsg = group.msgs[idx - 1];
                const isSameAuthor = prevMsg?.senderId === msg.senderId && prevMsg?.msgType === 'user';
                const isMentioned = currentUser && msg.mentions.includes(currentUser.id);

                return (
                  <div
                    key={msg.id}
                    className={`group flex gap-2.5 ${isSameAuthor ? 'mt-0.5' : 'mt-3'} ${isMentioned ? 'bg-primary/5 -mx-2 px-2 rounded-lg py-0.5' : ''}`}
                  >
                    {!isSameAuthor ? (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                        isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                      }`}>
                        {getInitials(msg.senderName)}
                      </div>
                    ) : (
                      <div className="w-7 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      {!isSameAuthor && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`text-xs font-semibold ${isOwn ? 'text-primary' : 'text-foreground'}`}>
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                          {isMentioned && (
                            <span className="flex items-center gap-0.5 text-[10px] text-primary font-medium">
                              <AtSign className="w-2.5 h-2.5" /> mentionné
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-foreground break-words">
                        {msg.content.split(/(@\w+)/).map((part, i) => {
                          if (part.startsWith('@')) {
                            const name = part.slice(1);
                            const mentioned = users.find(u => u.name.toLowerCase() === name.toLowerCase());
                            return mentioned
                              ? <span key={i} className="text-primary font-medium">{part}</span>
                              : <span key={i}>{part}</span>;
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </p>
                    </div>

                    {canDel && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="relative flex-shrink-0 mt-3 space-y-1.5">
        {/* Send error */}
        {sendError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {sendError}
            <button onClick={() => setSendError(null)} className="ml-auto underline hover:no-underline">Fermer</button>
          </div>
        )}

        {/* Mention suggestions */}
        {showMentions && filteredMentionUsers.length > 0 && canWriteInChannel && (
          <div className="absolute bottom-full mb-2 left-0 right-0 glass-card rounded-xl border border-border shadow-xl z-50 overflow-hidden">
            {filteredMentionUsers.map(u => (
              <button
                key={u.id}
                onClick={() => insertMention(u)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                  {getInitials(u.name)}
                </div>
                <span className="text-sm text-foreground">{u.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{u.team}</span>
              </button>
            ))}
          </div>
        )}

        {canWriteInChannel ? (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                if (e.key === 'Escape') setShowMentions(false);
              }}
              placeholder={
                isAnnouncesChannel
                  ? `Publier une annonce… (visible par tous)`
                  : `Message #${CHANNELS.find(c => c.id === activeChannel)?.label}… (@ pour mentionner)`
              }
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 transition-all flex-shrink-0"
            >
              {isAnnouncesChannel ? <Pin className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          /* Read-only notice for staff in #annonces */
          <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-xl px-4 py-3">
            <Pin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Ce canal est réservé aux annonces de l'équipe d'encadrement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
