import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import type { Team } from '../../types';
import {
  Home, Plus, Trash2, Edit2, Check, X,
  AlertTriangle, Loader2, Users, ArrowUp, ArrowDown, ShieldAlert,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  team_key: string;
  color: string;
  display_order: number;
  is_system: boolean;
}

const COLOR_OPTIONS = [
  { value: 'orange',  label: 'Orange',  css: 'bg-orange-500' },
  { value: 'red',     label: 'Rouge',   css: 'bg-red-500' },
  { value: 'blue',    label: 'Bleu',    css: 'bg-blue-500' },
  { value: 'purple',  label: 'Violet',  css: 'bg-purple-500' },
  { value: 'slate',   label: 'Ardoise', css: 'bg-slate-500' },
  { value: 'green',   label: 'Vert',    css: 'bg-green-500' },
  { value: 'teal',    label: 'Sarcelle',css: 'bg-teal-500' },
  { value: 'pink',    label: 'Rose',    css: 'bg-pink-500' },
  { value: 'indigo',  label: 'Indigo',  css: 'bg-indigo-500' },
  { value: 'amber',   label: 'Ambre',   css: 'bg-amber-500' },
];

const COLOR_BG: Record<string, string> = {
  orange: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
  red:    'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  blue:   'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  purple: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
  slate:  'bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300',
  green:  'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
  teal:   'bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
  pink:   'bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300',
  indigo: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
  amber:  'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
};

const COLOR_DOT: Record<string, string> = {
  orange: 'bg-orange-500', red: 'bg-red-500', blue: 'bg-blue-500',
  purple: 'bg-purple-500', slate: 'bg-slate-500', green: 'bg-green-500',
  teal: 'bg-teal-500', pink: 'bg-pink-500', indigo: 'bg-indigo-500', amber: 'bg-amber-500',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function toTeamKey(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RoomManagement() {
  const { users, updateUser } = useApp();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('blue');

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Drag-and-drop state
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);

  // ── Fetch ──
  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('display_order', { ascending: true });
    if (!error && data) setRooms(data as Room[]);
    setLoading(false);
  };

  useEffect(() => { fetchRooms(); }, []);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Add room ──
  const handleAddRoom = async () => {
    const name = newName.trim();
    if (!name) return showFeedback('error', 'Le nom de la salle est requis.');
    const team_key = toTeamKey(name);
    const maxOrder = rooms.reduce((m, r) => Math.max(m, r.display_order), 0);

    setSaving(true);
    const { error } = await supabase.from('rooms').insert({
      name,
      team_key,
      color: newColor,
      display_order: maxOrder + 1,
      is_system: false,
    });
    setSaving(false);

    if (error) {
      showFeedback('error', error.code === '23505' ? 'Une salle avec ce nom existe déjà.' : error.message);
    } else {
      showFeedback('success', `✅ Salle "${name}" créée`);
      setNewName('');
      setNewColor('blue');
      setShowAdd(false);
      fetchRooms();
    }
  };

  // ── Save edit ──
  const handleSaveEdit = async (room: Room) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    const { error } = await supabase.from('rooms').update({ name, color: editColor }).eq('id', room.id);
    setSaving(false);
    if (error) {
      showFeedback('error', error.message);
    } else {
      showFeedback('success', '✅ Salle mise à jour');
      setEditingId(null);
      fetchRooms();
    }
  };

  // ── Delete room ──
  const handleDeleteRoom = async (room: Room) => {
    if (room.is_system) return showFeedback('error', 'La salle système ne peut pas être supprimée.');
    const members = users.filter(u => u.team === room.team_key);
    if (members.length > 0) {
      return showFeedback('error', `Impossible : ${members.length} membre(s) sont encore dans cette salle. Réaffectez-les d'abord.`);
    }
    setSaving(true);
    const { error } = await supabase.from('rooms').delete().eq('id', room.id);
    setSaving(false);
    if (error) {
      showFeedback('error', error.message);
    } else {
      showFeedback('success', '✅ Salle supprimée');
      setDeleteConfirmId(null);
      fetchRooms();
    }
  };

  // ── Move order ──
  const handleMove = async (room: Room, direction: 'up' | 'down') => {
    const sorted = [...rooms];
    const idx = sorted.findIndex(r => r.id === room.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    setSaving(true);
    await Promise.all([
      supabase.from('rooms').update({ display_order: other.display_order }).eq('id', room.id),
      supabase.from('rooms').update({ display_order: room.display_order }).eq('id', other.id),
    ]);
    setSaving(false);
    fetchRooms();
  };

  // ── Drag & Drop reassign ──
  const handleDragStart = (e: React.DragEvent, userId: string) => {
    setDraggedUserId(userId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', userId);
  };

  const handleDragOver = (e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRoomId(roomId);
  };

  const handleDragLeave = () => {
    setDragOverRoomId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetRoom: Room) => {
    e.preventDefault();
    setDragOverRoomId(null);
    const userId = e.dataTransfer.getData('text/plain') || draggedUserId;
    setDraggedUserId(null);
    if (!userId) return;

    const user = users.find(u => u.id === userId);
    if (!user || user.team === targetRoom.team_key) return;

    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).update({ team: targetRoom.team_key }).eq('id', userId);
    setSaving(false);

    if (error) {
      showFeedback('error', error.message);
    } else {
      updateUser({ ...user, team: targetRoom.team_key as Team });
      showFeedback('success', `✅ ${user.name} → ${targetRoom.name}`);
    }
  };

  const handleDragEnd = () => {
    setDraggedUserId(null);
    setDragOverRoomId(null);
  };

  // ── Members per room ──
  const membersOf = (teamKey: string) => users.filter(u => u.team === teamKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            Gestion des salles
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{rooms.length} salle{rooms.length > 1 ? 's' : ''} · glissez les membres pour les réaffecter</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouvelle salle
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-xs font-medium ${
          feedback.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="glass-card rounded-xl p-4 space-y-3 border border-primary/20 animate-slide-up">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Créer une nouvelle salle
          </h3>
          <input
            type="text"
            placeholder="Nom de la salle (ex: Terrasse)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Couleur</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`w-7 h-7 rounded-full ${c.css} transition-all ${newColor === c.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setNewName(''); setNewColor('blue'); }}
              className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleAddRoom}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Room list */}
      <div className="space-y-2">
        {rooms.map((room, idx) => {
          const members = membersOf(room.team_key);
          const isEditing = editingId === room.id;
          const isDeleteConfirm = deleteConfirmId === room.id;
          const colorBg = COLOR_BG[room.color] || COLOR_BG.blue;
          const isDragOver = dragOverRoomId === room.id;

          return (
            <div
              key={room.id}
              className={`rounded-xl border overflow-hidden bg-card transition-all ${
                isDragOver
                  ? 'border-primary ring-2 ring-primary/30 scale-[1.01]'
                  : 'border-border'
              }`}
              onDragOver={(e) => handleDragOver(e, room.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, room)}
            >

              {/* Room header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Order buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(room, 'up')}
                    disabled={idx === 0 || saving}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(room, 'down')}
                    disabled={idx === rooms.length - 1 || saving}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Color dot */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOT[room.color] || 'bg-blue-500'}`} />

                {/* Name / Edit */}
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {COLOR_OPTIONS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => setEditColor(c.value)}
                          className={`w-5 h-5 rounded-full ${c.css} transition-all ${editColor === c.value ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{room.name}</span>
                      {room.is_system && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">système</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{room.team_key}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {members.length} membre{members.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSaveEdit(room)}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                    </>
                  ) : isDeleteConfirm ? (
                    <>
                      <span className="text-xs text-destructive font-medium">Supprimer ?</span>
                      <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 rounded-lg bg-secondary text-muted-foreground">
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room)}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(room.id); setEditName(room.name); setEditColor(room.color); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Renommer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!room.is_system && (
                        <button
                          onClick={() => setDeleteConfirmId(room.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-destructive transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Members list (draggable) + drop zone */}
              <div className={`border-t border-border px-4 py-2.5 transition-colors ${
                isDragOver ? 'bg-primary/10' : members.length > 0 ? 'bg-muted/30' : 'bg-transparent'
              }`}>
                {members.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {members.map(member => (
                      <div
                        key={member.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, member.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border cursor-grab active:cursor-grabbing select-none transition-all hover:border-primary/50 ${colorBg} ${
                          draggedUserId === member.id ? 'opacity-40 scale-95' : ''
                        }`}
                        title="Glissez pour réaffecter"
                      >
                        <span>{member.name}</span>
                        <svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                        </svg>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-[11px] italic transition-colors ${isDragOver ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {isDragOver ? '↓ Déposer ici pour affecter' : 'Aucun membre — glissez un membre ici'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-muted/50 border border-border">
        <ShieldAlert className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          La salle <strong>système</strong> ({rooms.find(r => r.is_system)?.name ?? 'Salle principale'}) est la salle par défaut et ne peut pas être supprimée.
          Toutes les autres salles peuvent être supprimées une fois leurs membres réaffectés.
          Glissez-déposez les badges pour réaffecter les membres.
        </p>
      </div>
    </div>
  );
}
