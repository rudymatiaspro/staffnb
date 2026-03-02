import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppProvider, useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import AuthLogin from './AuthLogin';
import Login from './Login';
import Dashboard from './Dashboard';

import { PinEntry } from '../components/auth/PinEntry';
import { verifyPin, isLegacyHash } from '../lib/pinCrypto';
import { Loader2, Lock } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';

// ─── Station PIN re-lock (6-digit) ────────────────────────────────────────────
function StationPinLockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const { currentUser } = useApp();
  const { signOut: authSignOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  if (!currentUser) return null;

  const digits = ['1','2','3','4','5','6','7','8','9','','0','del'];

  const handleKey = async (d: string) => {
    if (d === 'del') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) {
      setTimeout(async () => {
        // Verify against station_pin_hash
        const { data: profile } = await supabase
          .from('profiles').select('station_pin_hash').eq('id', currentUser.id).maybeSingle();

        const storedHash = (profile as any)?.station_pin_hash ?? '';
        let valid = false;
        if (!storedHash) {
          valid = next === '154154';
        } else if (storedHash.includes(':')) {
          const res = await verifyPin(storedHash, next);
          valid = res === 'match';
        } else {
          valid = storedHash === next;
        }
        if (valid) {
          onUnlock();
        } else {
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setError('PIN station incorrect. Réessaie.');
          setPin('');
        }
      }, 100);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-6">
          <img src={logo} alt="Staff&B" className="h-10 mx-auto mb-2 dark:hidden" />
          <img src={logoDark} alt="Staff&B" className="h-10 mx-auto mb-2 hidden dark:block" />
          <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground text-sm">
            <Lock className="w-4 h-4" />
            Station verrouillée
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6 shadow-xl space-y-5">
          <p className="text-center text-sm text-muted-foreground">Entrez le PIN station (6 chiffres)</p>
          {/* 6-dot indicator */}
          <div className={`flex justify-center gap-3 ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-primary scale-125' : 'bg-border'}`} />
            ))}
          </div>
          {error && (
            <div className="text-center text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {digits.map((d, i) => {
              if (d === '') return <div key={i} />;
              return (
                <button key={i} className="pin-btn" onClick={() => handleKey(d)}>
                  {d === 'del' ? <span className="text-base">⌫</span> : <span className="text-xl font-bold">{d}</span>}
                </button>
              );
            })}
          </div>
          <button onClick={() => authSignOut()} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 hover:underline">
            ← Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PIN re-lock overlay (standard 6-digit) ────────────────────────────────────
// Shown when user returns to the app after leaving (without logout)
function PinLockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const { currentUser } = useApp();
  const { signOut: authSignOut } = useAuth();
  const user = currentUser;
  const [error, setError] = useState('');

  if (!user) return null;

  const handlePinSuccess = async (pin: string) => {
    const storedHash = user.pin ?? '';
    let valid = false;

    if (!storedHash) {
      valid = pin === '1111';
    } else if (storedHash.includes(':')) {
      const res = await verifyPin(storedHash, pin);
      valid = res === 'match';
    } else if (isLegacyHash(storedHash)) {
      valid = storedHash === btoa(pin);
    } else {
      valid = storedHash === pin;
    }

    if (valid) {
      onUnlock();
    } else {
      setError('PIN incorrect. Réessaie.');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={logo} alt="Staff&B" className="h-10 mx-auto mb-2 dark:hidden" />
          <img src={logoDark} alt="Staff&B" className="h-10 mx-auto mb-2 hidden dark:block" />
          <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground text-sm">
            <Lock className="w-4 h-4" />
            Session verrouillée
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6 shadow-xl">
          {error && (
            <div className="mb-4 text-center text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 animate-slide-up">
              {error}
            </div>
          )}
          <PinEntry
            user={user}
            isFirstTime={false}
            onSuccess={handlePinSuccess}
            onBack={() => authSignOut()}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Pin lock wrapper ─────────────────────────────────────────────────────────
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function PinLockWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp();
  const [locked, setLocked] = useState(false);
  const lastActiveRef = React.useRef(Date.now());

  const resetTimer = useCallback(() => {
    lastActiveRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    const handleVisibility = () => {
      if (document.hidden) {
        lastActiveRef.current = Date.now();
      } else {
        const elapsed = Date.now() - lastActiveRef.current;
        if (elapsed > LOCK_TIMEOUT_MS) {
          setLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser, resetTimer]);

  if (!currentUser) return <>{children}</>;

  const isStation = currentUser.role === 'station';

  return (
    <>
      {locked && isStation && <StationPinLockOverlay onUnlock={() => setLocked(false)} />}
      {locked && !isStation && <PinLockOverlay onUnlock={() => setLocked(false)} />}
      {children}
    </>
  );
}


// ─── Auto-login for Owner / Station accounts ──────────────────────────────────
// These roles skip the "Qui es-tu ?" selector and connect directly.
function AutoLoginGate({ children }: { children: React.ReactNode }) {
  const { supabaseUser } = useAuth();
  const { users, currentUser, login } = useApp();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!supabaseUser) { setChecking(false); return; }

    // Look for the matching profile in the loaded users list
    const matchedUser = users.find((u) => u.id === supabaseUser.id);
    if (!matchedUser) {
      // Users not loaded yet — wait
      if (users.length > 0) setChecking(false);
      return;
    }

    // Owner, Manager, and Station → auto-login directly (they already authenticated via email/password)
    if (['owner', 'station', 'manager'].includes(matchedUser.role ?? '') && !currentUser) {
      login(matchedUser);
    }
    setChecking(false);
  }, [supabaseUser, users, currentUser, login]);

  if (checking && users.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src={logo} alt="Staff&B" className="h-10 mx-auto animate-pulse" />
          <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Connexion…
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Inner router: handles in-app staff PIN selection ─────────────────────────
function AppRouter() {
  const { currentUser } = useApp();

  if (!currentUser) return <Login />;
  return <Dashboard />;
}

// ─── Onboarding: seed the authenticated user's profile & role ─────────────────
function ProfileSeeder({ children }: { children: React.ReactNode }) {
  const { supabaseUser } = useAuth();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!supabaseUser) { setSeeded(true); return; }

    async function seed() {
      try {
        // Check if profile already exists
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', supabaseUser!.id);

        if (!existingProfiles || existingProfiles.length === 0) {
          // Create profile
          await supabase.from('profiles').insert({
            id: supabaseUser!.id,
            name: supabaseUser!.user_metadata?.name || supabaseUser!.email?.split('@')[0] || 'User',
            team: 'MANAGEMENT' as const,
            pin_set: false,
            station_pin_set: false,
          });
        }

        // Check if role exists
        const { data: existingRoles } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', supabaseUser!.id);

        if (!existingRoles || existingRoles.length === 0) {
          // Check total user count — first user becomes owner
          const { count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true });

          const role = (count ?? 0) === 0 ? 'owner' : 'staff';
          await supabase.from('user_roles').insert({ user_id: supabaseUser!.id, role });
        }
      } catch (err) {
        console.error('Profile seed error:', err);
      } finally {
        setSeeded(true);
      }
    }

    seed();
  }, [supabaseUser]);

  if (!seeded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src={logo} alt="Staff&B" className="h-10 mx-auto" />
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting up your account…
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Auth gate ────────────────────────────────────────────────────────────────
function AuthGate() {
  const { supabaseUser, loading } = useAuth();
  const [userRole, setUserRole] = React.useState<string | null | undefined>(undefined);
  const [godImpersonating, setGodImpersonating] = React.useState<string | null>(
    sessionStorage.getItem('god_impersonating')
  );

  React.useEffect(() => {
    if (!supabaseUser) { setUserRole(null); return; }
    supabase.from('user_roles').select('role').eq('user_id', supabaseUser.id).maybeSingle()
      .then(({ data }) => setUserRole(data?.role ?? null));
  }, [supabaseUser]);

  // Poll sessionStorage for god_impersonating (set by AuthLogin after restaurant+account selection)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const val = sessionStorage.getItem('god_impersonating');
      setGodImpersonating(val);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (loading || (supabaseUser && userRole === undefined)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src={logo} alt="Staff&B" className="h-10 mx-auto animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading Staff&B…</p>
        </div>
      </div>
    );
  }

  if (!supabaseUser) {
    return <AuthLogin />;
  }

  // GOD / Admin: show AuthLogin (restaurant selector) until impersonation is confirmed
  if ((userRole === 'god' || userRole === 'admin') && !godImpersonating) {
    return <AuthLogin />;
  }

  return (
    <ProfileSeeder>
      <AppProvider>
        <AutoLoginGate>
          <PinLockWrapper>
            <AppRouter />
          </PinLockWrapper>
        </AutoLoginGate>
      </AppProvider>
    </ProfileSeeder>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────
export default function Index() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

