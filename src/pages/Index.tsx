import { useEffect, useState, useRef } from 'react';
import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppProvider, useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import AuthLogin from './AuthLogin';
import Login from './Login';
import Dashboard from './Dashboard';
import Station from './Station';
import { Loader2 } from 'lucide-react';
import logo from '../assets/logo.svg';

// ─── Inner router: handles in-app staff PIN selection ─────────────────────────
function AppRouter() {
  const { currentUser } = useApp();
  const { supabaseUser } = useAuth();
  const [userRole, setUserRole] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!supabaseUser) { setUserRole(null); return; }
    supabase.from('user_roles').select('role').eq('user_id', supabaseUser.id).maybeSingle()
      .then(({ data }) => setUserRole(data?.role ?? null));
  }, [supabaseUser]);

  // Still loading role
  if (userRole === undefined) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  // GOD and ADMIN must go through AuthLogin restaurant selector — never go to staff Login
  if (userRole === 'god' || userRole === 'admin') {
    // AuthLogin handles the restaurant_select → account_list → impersonate flow
    // We stay on AuthLogin until impersonation sets god_impersonating in sessionStorage
    const impersonating = sessionStorage.getItem('god_impersonating');
    if (!impersonating) return <AuthLogin />;
    // After impersonation, currentUser is set via AppContext; render Dashboard
    if (!currentUser) return <AuthLogin />;
    return <Dashboard />;
  }

  if (!currentUser) return <Login />;
  // Station accounts go directly to the Station homepage
  if (currentUser.role === 'station') return <Station />;
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

  if (loading) {
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

  return (
    <ProfileSeeder>
      <AppProvider>
        <AppRouter />
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
