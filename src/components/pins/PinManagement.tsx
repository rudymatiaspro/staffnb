import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Team } from '../../types';
import { KeyRound, Eye, EyeOff, RefreshCw, Check, AlertTriangle, Shuffle } from 'lucide-react';
import { TEAM_LABELS, TEAM_CSS } from '../../data/initialData';

interface Props {
  teamFilter?: Team; // manager: only their team
}

export function PinManagement({ teamFilter }: Props) {
  const { users, setPin, resetPin, currentUser } = useApp();
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);

  const staffList = users.filter(u => {
    if (teamFilter) return u.team === teamFilter && u.role === 'staff';
    return u.role !== 'owner'; // owner sees all non-owner
  });

  const allPins = users.filter(u => u.pinSet && u.pin).map(u => u.pin);

  const generateRandomPin = (): string => {
    let pin: string;
    let attempts = 0;
    do {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      attempts++;
    } while (allPins.includes(pin) && attempts < 100);
    return pin;
  };

  const handleSavePin = (userId: string) => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinError('Le PIN de connexion doit être exactement 6 chiffres');
      return;
    }
    // Check uniqueness (exclude the user being edited)
    const duplicate = users.find(u => u.id !== userId && u.pinSet && u.pin === newPin);
    if (duplicate) {
      setPinError('Ce PIN est déjà utilisé par un autre membre. Choisissez-en un autre.');
      return;
    }
    setPin(userId, newPin);
    setEditingUserId(null);
    setNewPin('');
    setPinError('');
  };

  const handleReset = (userId: string) => {
    resetPin(userId);
    setResetConfirmId(null);
  };

  const toggleShow = (userId: string) => {
    setShowPins(p => ({ ...p, [userId]: !p[userId] }));
  };

  const noPinUsers = staffList.filter(u => !u.pinSet || !u.pin);
  const hasPinUsers = staffList.filter(u => u.pinSet && u.pin);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            PIN Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasPinUsers.length} with PIN · {noPinUsers.length > 0 && <span className="text-amber-500 font-medium">{noPinUsers.length} without PIN</span>}
          </p>
        </div>
      </div>

      {noPinUsers.length > 0 && (
        <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Staff without PINs</span>
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-500">
            {noPinUsers.map(u => u.name).join(', ')} — cannot log in until a PIN is set
          </p>
        </div>
      )}

      <div className="space-y-2">
        {staffList.map(user => (
          <UserPinRow
            key={user.id}
            user={user}
            showPin={showPins[user.id] || false}
            isEditing={editingUserId === user.id}
            newPin={newPin}
            pinError={editingUserId === user.id ? pinError : ''}
            onToggleShow={() => toggleShow(user.id)}
            onStartEdit={() => {
              setEditingUserId(user.id);
              setNewPin('');
              setPinError('');
            }}
            onCancelEdit={() => {
              setEditingUserId(null);
              setNewPin('');
              setPinError('');
            }}
            onPinChange={(v) => {
              setNewPin(v.replace(/\D/g, '').slice(0, 4));
              setPinError('');
            }}
            onSave={() => handleSavePin(user.id)}
            onGenerate={() => setNewPin(generateRandomPin())}
            onReset={() => setResetConfirmId(user.id)}
          />
        ))}
      </div>

      {/* Reset confirmation */}
      {resetConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-sm font-bold text-foreground mb-2">Reset PIN?</h3>
            <p className="text-xs text-muted-foreground mb-5">
              {users.find(u => u.id === resetConfirmId)?.name}'s PIN will be cleared. They won't be able to log in until a new PIN is set.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setResetConfirmId(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => handleReset(resetConfirmId)} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90">Reset PIN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserPinRow({ user, showPin, isEditing, newPin, pinError, onToggleShow, onStartEdit, onCancelEdit, onPinChange, onSave, onGenerate, onReset }: {
  user: User;
  showPin: boolean;
  isEditing: boolean;
  newPin: string;
  pinError: string;
  onToggleShow: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onPinChange: (v: string) => void;
  onSave: () => void;
  onGenerate: () => void;
  onReset: () => void;
}) {
  const hasPIN = user.pinSet && user.pin;

  return (
    <div className={`glass-card rounded-xl p-3 space-y-2 ${!hasPIN ? 'border border-amber-200 dark:border-amber-900/40' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 team-badge ${TEAM_CSS[user.team]}`}>
          {user.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{user.name}</p>
          <p className="text-[10px] text-muted-foreground">{TEAM_LABELS[user.team]} · {user.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPIN ? (
            <>
              <span className="text-xs font-mono text-muted-foreground">{showPin ? user.pin : '••••'}</span>
              <button onClick={onToggleShow} className="p-1 rounded hover:bg-secondary">
                {showPin ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-timer-safe">
                <Check className="w-3 h-3" /> Active
              </span>
            </>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-500">
              <AlertTriangle className="w-3 h-3" /> No PIN
            </span>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="flex gap-2 pt-1">
          <button onClick={onStartEdit} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-foreground font-medium hover:bg-secondary">
            {hasPIN ? 'Change PIN' : 'Set PIN'}
          </button>
          {hasPIN && (
            <button onClick={onReset} className="px-3 py-1.5 rounded-lg text-xs text-timer-danger font-medium hover:bg-destructive/10">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {isEditing && (
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              inputMode="numeric"
              placeholder="4-digit PIN"
              value={newPin}
              onChange={e => onPinChange(e.target.value)}
              maxLength={4}
              className="flex-1 text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground font-mono tracking-widest placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={onGenerate} title="Generate random PIN" className="p-2 rounded-xl border border-border hover:bg-secondary">
              <Shuffle className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          {pinError && <p className="text-[10px] text-timer-danger">{pinError}</p>}
          <div className="flex gap-2">
            <button onClick={onCancelEdit} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">Cancel</button>
            <button onClick={onSave} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
