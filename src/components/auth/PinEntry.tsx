import { useState } from 'react';
import { User, UserRole } from '../../types';
import { Delete, ShieldCheck } from 'lucide-react';
import { TEAM_CSS } from '../../data/initialData';

const ROLE_CLASS_LABELS: Record<UserRole | 'god', string> = {
  god: 'Divinité',
  admin: 'Administrateur',
  owner: 'Propriétaire',
  manager: 'Manager',
  chef: 'Chef',
  staff: 'Équipier',
  station: 'Station',
};

interface PinEntryProps {
  user: User;
  isFirstTime: boolean;
  onSuccess: (pin: string) => void;
  onBack: () => void;
  restaurantName?: string;
  restaurantCity?: string;
}

const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

export function PinEntry({ user, isFirstTime, onSuccess, onBack, restaurantName, restaurantCity }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const currentPin = step === 'enter' ? pin : confirmPin;
  const setCurrentPin = step === 'enter' ? setPin : setConfirmPin;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleDigit = (digit: string) => {
    if (currentPin.length >= 4) return;
    const newPin = currentPin + digit;
    setCurrentPin(newPin);
    setError('');

    if (newPin.length === 4) {
      setTimeout(() => {
        if (!isFirstTime) {
          onSuccess(newPin);
        } else if (step === 'enter') {
          setStep('confirm');
          setConfirmPin('');
        } else {
          if (newPin === pin) {
            onSuccess(pin);
          } else {
            triggerShake();
            setError('PINs do not match. Please try again.');
            setPin('');
            setConfirmPin('');
            setStep('enter');
          }
        }
      }, 150);
    }
  };

  const handleDelete = () => {
    setCurrentPin((p) => p.slice(0, -1));
    setError('');
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  const stepLabel = isFirstTime
    ? step === 'enter'
      ? 'Create your 4-digit PIN'
      : 'Confirm your PIN'
    : 'Enter your PIN';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* User badge */}
      <div className="text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center team-card ${TEAM_CSS[user.team]} mx-auto mb-3 shadow-lg overflow-hidden`}>
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold">{getInitials(user.name)}</span>
          )}
        </div>
        <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
        {/* Role class + restaurant info */}
        <p className="text-sm text-muted-foreground mt-0.5">
          {ROLE_CLASS_LABELS[user.role as UserRole | 'god'] ?? user.role}
          {restaurantName && (
            <> · {restaurantName}{restaurantCity ? `, ${restaurantCity}` : ''}</>
          )}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{stepLabel}</p>
        {isFirstTime && step === 'enter' && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-primary/80 mt-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5 inline-flex mx-auto">
            <ShieldCheck className="w-3 h-3" />
            This PIN is personal and confidential
          </div>
        )}
      </div>

      {/* PIN dots */}
      <div className={`flex justify-center gap-5 transition-all ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < currentPin.length ? 'bg-primary scale-125' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-center text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 animate-slide-up">
          {error}
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          if (d === 'del') {
            return (
              <button
                key={i}
                className="pin-btn"
                onClick={handleDelete}
                aria-label="Delete last digit"
              >
                <Delete className="w-5 h-5" />
              </button>
            );
          }
          return (
            <button
              key={i}
              className="pin-btn"
              onClick={() => handleDigit(d)}
            >
              <span className="text-xl font-bold">{d}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 hover:underline underline-offset-2"
      >
        ← Change user
      </button>
    </div>
  );
}
