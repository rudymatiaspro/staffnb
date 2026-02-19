import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Send, Hash, Users, Wine, ChefHat, Layers, PersonStanding, Settings, AtSign, Trash2, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  channel: string;
  content: string;
  senderId: string;
  senderName: string;
  senderTeam: string;
  mentions: string[];
  createdAt: Date;
}

const CHANNELS = [
  { id: 'general', label: 'général', icon: <Hash className="w-3.5 h-3.5" /> },
  { id: 'bar', label: 'bar', icon: <Wine className="w-3.5 h-3.5" /> },
  { id: 'kitchen', label: 'cuisine', icon: <ChefHat className="w-3.5 h-3.5" /> },
  { id: 'patisserie', label: 'pâtisserie', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'restaurant', label: 'restaurant', icon: <PersonStanding className="w-3.5 h-3.5" /> },
  { id: 'managers', label: 'managers', icon: <Settings className="w-3.5 h-3.5" /> },
];

const TEAM_TO_CHANNEL: Record<string, string> = {
  BAR: 'bar', KITCHEN: 'kitchen', ATELIER: 'patisserie', FLOOR: 'restaurant', MANAGEMENT: 'managers',
};

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

interface MessagingModuleProps {
  canManageAll?: boolean;
}

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
  const lastSeenRef = useRef<Record<string, Date>>({});

  // Filter channels for non-managers
  const userRole = currentUser?.role as string | undefined;
  const availableChannels = CHANNELS.filter(ch => {
    if (ch.id === 'managers') return canManageAll || ['manager', 'owner', 'admin', 'chef'].includes(userRole ?? '');
    return true;
  });

  const fetchMessages = useCallback(async (channel: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(100);
    if (!error && data) {
      setMessages(data.map(r => ({
        id: r.id,
        channel: r.channel,
        content: r.content,
        senderId: r.sender_id,
        senderName: r.sender_name,
        senderTeam: r.sender_team,
        mentions: r.mentions ?? [],
        createdAt: new Date(r.created_at),
      })));
      lastSeenRef.current[channel] = new Date();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages(activeChannel);
  }, [activeChannel, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Record<string, unknown>;
        const newMsg: Message = {
          id: msg.id as string,
          channel: msg.channel as string,
          content: msg.content as string,
          senderId: msg.sender_id as string,
          senderName: msg.sender_name as string,
          senderTeam: msg.sender_team as string,
          mentions: (msg.mentions as string[]) ?? [],
          createdAt: new Date(msg.created_at as string),
        };
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
    return () => { supabase.removeChannel(channel); };
  }, [activeChannel]);

  const handleChannelChange = (ch: string) => {
    setActiveChannel(ch);
    setUnreadCounts(prev => ({ ...prev, [ch]: 0 }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    // Detect @ mention
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

  const sendMessage = async () => {
    if (!input.trim() || !currentUser) return;
    // Extract mentions
    const mentionedNames = [...input.matchAll(/@(\w+)/g)].map(m => m[1].toLowerCase());
    const mentionedIds = users
      .filter(u => mentionedNames.includes(u.name.toLowerCase()))
      .map(u => u.id);

    const { error } = await supabase.from('messages').insert({
      channel: activeChannel,
      content: input.trim(),
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_team: currentUser.team,
      mentions: mentionedIds,
    });
    if (!error) {
      setInput('');
      setShowMentions(false);
    }
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('messages').delete().eq('id', msgId);
  };

  const filteredMentionUsers = mentionQuery
    ? users.filter(u => u.name.toLowerCase().startsWith(mentionQuery) && u.id !== currentUser?.id)
    : users.filter(u => u.id !== currentUser?.id).slice(0, 6);

  // Group messages by date
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto glass-card rounded-2xl p-4 space-y-1 border border-border">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Chargement…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p className="text-sm">Aucun message dans #{CHANNELS.find(c => c.id === activeChannel)?.label}</p>
            <p className="text-xs">Soyez le premier à écrire !</p>
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
                const prevMsg = group.msgs[idx - 1];
                const isSameAuthor = prevMsg?.senderId === msg.senderId;
                const isMentioned = currentUser && msg.mentions.includes(currentUser.id);

                return (
                  <div
                    key={msg.id}
                    className={`group flex gap-2.5 ${isSameAuthor ? 'mt-0.5' : 'mt-3'} ${isMentioned ? 'bg-primary/5 -mx-2 px-2 rounded-lg py-0.5' : ''}`}
                  >
                    {/* Avatar */}
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
                            return mentioned ? (
                              <span key={i} className="text-primary font-medium">{part}</span>
                            ) : <span key={i}>{part}</span>;
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </p>
                    </div>

                    {/* Delete button */}
                    {(isOwn || canManageAll) && (
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
      <div className="relative flex-shrink-0 mt-3">
        {/* Mention suggestions */}
        {showMentions && filteredMentionUsers.length > 0 && (
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

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              if (e.key === 'Escape') setShowMentions(false);
            }}
            placeholder={`Message #${CHANNELS.find(c => c.id === activeChannel)?.label}… (@ pour mentionner)`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 transition-all flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
