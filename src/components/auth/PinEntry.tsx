import { useState } from 'react';
import { User } from '../../types';
import { Delete, Eye, EyeOff } from 'lucide-react';
import { ZONE_CSS, ZONE_EMOJI } from '../../data/initialData';

interface PinEntryProps {
  user: User;
  isFirstTime: boolean;
  onSuccess: (pin: string) => void;
  onBack: () => void;
}

export function PinEntry({ user, isFirstTime, onSuccess, onBack }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleDigit = (digit: string) => {
    if (step === 'enter' && pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      if (!isFirstTime && newPin.length === 4) {
        onSuccess(newPin);
      }
      if (isFirstTime && newPin.length === 4) {
        setStep('confirm');
      }
    } else if (step === 'confirm' && confirmPin.length < 4) {
      const newConfirm = confirmPin + digit;
      setConfirmPin(newConfirm);
      setError('');
      if (newConfirm.length === 4) {
        if (newConfirm === pin) {
          onSuccess(pin);
        } else {
          setError('Les PINs ne correspondent pas. Réessayez.');
          setPin('');
          setConfirmPin('');
          setStep('enter');
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'enter') setPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  };

  const currentPin = step === 'enter' ? pin : confirmPin;
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="animate-slide-up space-y-6">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center zone-card ${ZONE_CSS[user.zone]} text-3xl mx-auto mb-3`}>
          {ZONE_EMOJI[user.zone]}
        </div>
        <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isFirstTime
            ? step === 'enter'
              ? 'Choisissez votre PIN à 4 chiffres'
              : 'Confirmez votre PIN'
            : 'Entrez votre PIN'}
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < currentPin.length
                ? 'bg-primary scale-110'
                : 'bg-border'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
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
                aria-label="Supprimer"
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
              {d}
            </button>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        ← Retour
      </button>
    </div>
  );
}
