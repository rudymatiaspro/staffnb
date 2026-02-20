import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { NameSelector } from '../components/auth/NameSelector';
import { PinEntry } from '../components/auth/PinEntry';
import { verifyPin, hashPin, isLegacyHash } from '../lib/pinCrypto';
import { supabase } from '../integrations/supabase/client';
import { logAudit } from '../lib/auditLogger';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';

type LoginStep = 'select' | 'pin' | 'set_new_pin';

// Update pin_hash via edge function (works for both auth and synthetic profiles)
async function updatePinHash(profileId: string, pinHash: string, pinSet = true) {
  try {
    // Try direct Supabase update first (works when user has an auth session)
    const { error } = await supabase
      .from('profiles')
      .update({ pin_hash: pinHash, pin_set: pinSet })
      .eq('id', profileId);

    if (!error) return;

    // Fallback: use edge function for synthetic (PIN-only) profiles
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    await supabase.functions.invoke('update-pin', {
      body: { profileId, pinHash, pinSet },
    });
  } catch {
    // Silently fail — local state is already updated
  }
}

export default function Login() {
  const { login, setPin, users } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [step, setStep] = useState<LoginStep>('select');
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingPin, setPendingPin] = useState('');

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setStep('pin');
    setErrorMsg('');
  };

  // ── Step 1: verify PIN (async PBKDF2 / legacy btoa / default 1111) ──────────
  const handlePinSuccess = async (pin: string) => {
    if (!selectedUser) return;

    if (!selectedUser.pinSet) {
      // First login — any PIN accepted (default 1111), force new PIN choice
      setPendingPin('');
      setStep('set_new_pin');
      return;
    }

    const storedHash = selectedUser.pin ?? '';
    let valid = false;

    if (!storedHash) {
      valid = pin === '1111';
    } else if (storedHash.includes(':')) {
      // PBKDF2
      const res = await verifyPin(storedHash, pin);
      valid = res === 'match';
    } else if (isLegacyHash(storedHash)) {
      // Legacy btoa — migrate to PBKDF2 on success
      valid = storedHash === btoa(pin);
      if (valid) {
        const newHash = await hashPin(pin);
        await updatePinHash(selectedUser.id, newHash, true);
      }
    } else {
      valid = storedHash === pin;
    }

    if (valid) {
      await logAudit(selectedUser.id, selectedUser.name, 'login');
      login(selectedUser);
    } else {
      setErrorMsg('PIN incorrect. Réessaie.');
      setSelectedUser(null);
      setStep('select');
    }
  };

  // ── Step 2: set new PIN (PBKDF2) ────────────────────────────────────────────
  const handleNewPinSuccess = async (pin: string) => {
    if (!selectedUser) return;
    const newHash = await hashPin(pin);
    // Persist via edge function (supports synthetic profiles without auth session)
    await updatePinHash(selectedUser.id, newHash, true);
    // Update local state
    setPin(selectedUser.id, newHash);
    await logAudit(selectedUser.id, selectedUser.name, 'login');
    login({ ...selectedUser, pin: newHash, pinSet: true });
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
          <img src={logo} alt="Staff&B" className="h-12 mx-auto mb-2 dark:hidden" />
          <img src={logoDark} alt="Staff&B" className="h-12 mx-auto mb-2 hidden dark:block" />
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">F&amp;B Team Management</p>
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
          Staff&amp;B © 2026 · v0.1
        </p>
      </div>
    </div>
  );
}
