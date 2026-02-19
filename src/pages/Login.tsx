import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { NameSelector } from '../components/auth/NameSelector';
import { PinEntry } from '../components/auth/PinEntry';
import logo from '../assets/logo.svg';

type LoginStep = 'select' | 'pin' | 'set_new_pin';

export default function Login() {
  const { login, setPin, validatePin } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [step, setStep] = useState<LoginStep>('select');
  const [errorMsg, setErrorMsg] = useState('');
  // Temporarily hold the entered PIN so we can confirm it before saving
  const [pendingPin, setPendingPin] = useState('');

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setStep('pin');
    setErrorMsg('');
  };

  // ── Step 1: user enters their current PIN (or the default 1111) ──────────────
  const handlePinSuccess = (pin: string) => {
    if (!selectedUser) return;

    if (!selectedUser.pinSet) {
      // First ever login — accepted the default 1111, now force a new PIN
      setPendingPin(''); // will be set in the confirm step
      setStep('set_new_pin');
      return;
    }

    // Normal login: validate stored PIN
    const valid = validatePin(selectedUser.id, pin);
    if (valid) {
      login(selectedUser);
    } else {
      setErrorMsg('PIN incorrect. Réessaie.');
      setSelectedUser(null);
      setStep('select');
    }
  };

  // ── Step 2: user chooses + confirms their new PIN ────────────────────────────
  const handleNewPinSuccess = (pin: string) => {
    if (!selectedUser) return;
    // PinEntry in isFirstTime mode calls onSuccess only after double-confirm
    setPin(selectedUser.id, pin);
    login({ ...selectedUser, pin: btoa(pin), pinSet: true });
  };

  const handleBack = () => {
    setSelectedUser(null);
    setStep('select');
    setErrorMsg('');
    setPendingPin('');
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
          <img src={logo} alt="Staff&B" className="h-12 mx-auto mb-2" />
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">Casinha · Team Management</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-6 shadow-xl">
          {step === 'select' && (
            <>
              <h2 className="text-base font-bold text-foreground mb-4">Qui es-tu ?</h2>
              <NameSelector onSelect={handleUserSelect} />
              {errorMsg && (
                <div className="mt-4 text-center text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 animate-slide-up">
                  {errorMsg}
                </div>
              )}
            </>
          )}

          {step === 'pin' && selectedUser && (
            <PinEntry
              user={selectedUser}
              isFirstTime={false}
              onSuccess={handlePinSuccess}
              onBack={handleBack}
            />
          )}

          {step === 'set_new_pin' && selectedUser && (
            <div className="space-y-4">
              {/* Explanatory banner */}
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">Bienvenue, {selectedUser.name} !</p>
                <p className="text-xs text-muted-foreground">
                  Première connexion — choisis ton PIN personnel.<br />
                  Il remplacera le PIN par défaut <strong>1111</strong>.
                </p>
              </div>
              <PinEntry
                user={selectedUser}
                isFirstTime={true}
                onSuccess={handleNewPinSuccess}
                onBack={handleBack}
              />
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Staff&B © {new Date().getFullYear()} · v2.0
        </p>
      </div>
    </div>
  );
}
