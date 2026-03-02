import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { NameSelector } from '../components/auth/NameSelector';
import { PinEntry } from '../components/auth/PinEntry';
import { verifyPin, hashPin, isLegacyHash } from '../lib/pinCrypto';
import { supabase } from '../integrations/supabase/client';
import { logAudit } from '../lib/auditLogger';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import { LogOut } from 'lucide-react';

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

    // Fallback: use edge function (requires auth session)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[updatePinHash] No auth session — cannot call edge function');
      return;
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
  const { signOut } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [step, setStep] = useState<LoginStep>('select');
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [restaurantName, setRestaurantName] = useState<string | undefined>();
  const [restaurantCity, setRestaurantCity] = useState<string | undefined>();

  const handleUserSelect = async (user: User) => {
    // Fetch restaurant info for this user
    setRestaurantName(undefined);
    setRestaurantCity(undefined);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.restaurant_id) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name, city')
          .eq('id', profile.restaurant_id)
          .maybeSingle();
        if (restaurant) {
          setRestaurantName(restaurant.name ?? undefined);
          setRestaurantCity(restaurant.city ?? undefined);
        }
      }
    } catch {
      // Silently ignore — restaurant info is optional display only
    }
    setSelectedUser(user);
    setStep('pin');
    setErrorMsg('');
  };

  // ── Step 1: verify PIN (async PBKDF2 / legacy btoa / default 000111) ──────────
  const handlePinSuccess = async (pin: string) => {
    if (!selectedUser) return;

    // Check account status and lockout from DB
    const { data: profile } = await supabase
      .from('profiles')
      .select('pin_locked, pin_attempts, status, pin_force_reset')
      .eq('id', selectedUser.id)
      .maybeSingle() as any;

    if (profile?.status === 'disabled') {
      setErrorMsg('Compte désactivé. Contactez votre Manager.');
      setSelectedUser(null);
      setStep('select');
      return;
    }
    if (profile?.status === 'suspended') {
      setErrorMsg('Compte suspendu. Contactez votre Manager.');
      setSelectedUser(null);
      setStep('select');
      return;
    }
    if (profile?.pin_locked) {
      setErrorMsg('Compte bloqué après 5 tentatives. Contactez votre Admin/Master.');
      setSelectedUser(null);
      setStep('select');
      return;
    }

    if (!selectedUser.pinSet) {
      // First login — any PIN accepted (default 1111), force new PIN choice
      setPendingPin('');
      setStep('set_new_pin');
      return;
    }

    // Force reset required by admin
    if (profile?.pin_force_reset) {
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
      // Reset attempts counter on success
      await supabase.from('profiles').update({ pin_attempts: 0, pin_locked: false, pin_force_reset: false } as any).eq('id', selectedUser.id);
      await logAudit(selectedUser.id, selectedUser.name, 'login');
      login(selectedUser);
    } else {
      const attempts = (profile?.pin_attempts ?? 0) + 1;
      const locked = attempts >= 5;
      await supabase.from('profiles').update({
        pin_attempts: attempts,
        pin_locked: locked,
        pin_locked_at: locked ? new Date().toISOString() : null,
      } as any).eq('id', selectedUser.id);

      if (locked) {
        setErrorMsg('Compte bloqué après 5 tentatives. Contactez votre Admin/Master.');
      } else {
        setErrorMsg(`PIN incorrect. ${5 - attempts} tentative${5 - attempts > 1 ? 's' : ''} restante${5 - attempts > 1 ? 's' : ''}.`);
      }
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
      {/* Logout button — always visible during staff login phase */}
      <button
        onClick={() => signOut()}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:border-primary/40 transition-all"
      >
        <LogOut className="w-3.5 h-3.5" />
        Déconnexion
      </button>
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
              restaurantName={restaurantName}
              restaurantCity={restaurantCity}
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
                restaurantName={restaurantName}
                restaurantCity={restaurantCity}
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
