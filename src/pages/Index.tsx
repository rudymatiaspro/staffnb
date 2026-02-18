import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppProvider, useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import AuthLogin from './AuthLogin';
import Login from './Login';
import Dashboard from './Dashboard';
import { Loader2, UtensilsCrossed } from 'lucide-react';

// ─── Inner router: handles in-app staff PIN selection ─────────────────────────
function AppRouter() {
  const { currentUser } = useApp();
  return currentUser ? <Dashboard /> : <Login />;
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
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', supabaseUser!.id)
          .single();

        if (!existingProfile) {
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
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', supabaseUser!.id)
          .single();

        if (!existingRole) {
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
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
          </div>
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
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto animate-pulse">
            <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
          </div>
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
