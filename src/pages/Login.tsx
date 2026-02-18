import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { NameSelector } from '../components/auth/NameSelector';
import { PinEntry } from '../components/auth/PinEntry';
import { UtensilsCrossed, Zap } from 'lucide-react';

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
      setPin(selectedUser.id, pin);
      login({ ...selectedUser, pin, pinSet: true });
    } else {
      const valid = validatePin(selectedUser.id, pin);
      if (valid) {
        login(selectedUser);
      } else {
        setErrorMsg('Incorrect PIN. Please try again.');
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
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px] -translate-x-1/4 translate-y-1/4" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-primary-foreground" />
            <Zap className="absolute -top-1.5 -right-1.5 w-5 h-5 text-accent fill-accent" />
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Staff<span className="text-accent">&amp;</span>B</h1>
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">Casinha · Team Management</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-6 shadow-xl">
          {step === 'select' ? (
            <>
              <h2 className="text-base font-bold text-foreground mb-4">Who are you?</h2>
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
          Staff&B © {new Date().getFullYear()} · v2.0
        </p>
      </div>
    </div>
  );
}
