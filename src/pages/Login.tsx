import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { NameSelector } from '../components/auth/NameSelector';
import { PinEntry } from '../components/auth/PinEntry';
import { UtensilsCrossed, Sparkles } from 'lucide-react';

type LoginStep = 'select' | 'pin';

export default function Login() {
  const { login, setPin, validatePin } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [step, setStep] = useState<LoginStep>('select');
  const [errorMsg, setErrorMsg] = useState('');

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setStep('pin');
    setErrorMsg('');
  };

  const handlePinSuccess = (pin: string) => {
    if (!selectedUser) return;

    if (!selectedUser.pinSet) {
      // First time — save PIN
      setPin(selectedUser.id, pin);
      login({ ...selectedUser, pin, pinSet: true });
    } else {
      const valid = validatePin(selectedUser.id, pin);
      if (valid) {
        login(selectedUser);
      } else {
        setErrorMsg('PIN incorrect. Réessayez.');
        setSelectedUser(null);
        setStep('select');
      }
    }
  };

  const handleBack = () => {
    setSelectedUser(null);
    setStep('select');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[120px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-zone-atelier/5 blur-[100px] -translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-zone-cuisine/4 blur-[80px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl mb-4 shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-primary" />
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-primary/60" />
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Casinha</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Gestion d'équipe · Restaurant</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-6">
          {step === 'select' ? (
            <>
              <h2 className="text-lg font-bold text-foreground mb-4">Qui êtes-vous ?</h2>
              <NameSelector onSelect={handleUserSelect} />
              {errorMsg && (
                <div className="mt-4 text-center text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 animate-slide-up">
                  {errorMsg}
                </div>
              )}
            </>
          ) : selectedUser ? (
            <PinEntry
              user={selectedUser}
              isFirstTime={!selectedUser.pinSet}
              onSuccess={handlePinSuccess}
              onBack={handleBack}
            />
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Casinha Manager © {new Date().getFullYear()} · v1.0
        </p>
      </div>
    </div>
  );
}
