import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, LogOut, Search, ArrowLeft, Building2, Users } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import { supabase } from '../integrations/supabase/client';

type AuthStep = 'login' | 'restaurant_select' | 'account_list';

interface Restaurant {
  id: string;
  name: string;
  city: string | null;
  code: string;
}

interface AccountEntry {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  team: string;
}

const ROLE_ORDER = ['god', 'admin', 'owner', 'station', 'manager', 'chef', 'staff', 'sous-chef'];
const ROLE_LABELS: Record<string, string> = {
  god: 'ADMINISTRATEUR SYSTÈME',
  admin: 'ADMINISTRATEUR',
  owner: 'PROPRIÉTAIRE',
  station: 'STATION',
  manager: 'MANAGER',
  chef: 'CHEF',
  'sous-chef': 'SOUS-CHEF',
  staff: 'STAFF',
};

function InitialsAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const sz = size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground`}>
      {initials}
    </div>
  );
}

export default function AuthLogin() {
  const { signIn, signOut, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<AuthStep>('login');

  // God flow state
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Detect role after login to decide next step
  useEffect(() => {
    if (!session) return;
    async function detectRole() {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session!.user.id)
        .maybeSingle();
      const role = data?.role ?? null;
      setUserRole(role);
      if (role === 'god') {
        await loadRestaurants();
        setStep('restaurant_select');
      } else if (role === 'admin') {
        await loadAdminRestaurants(session!.user.id);
        setStep('restaurant_select');
      }
      // owner/manager → handled by Index.tsx / AppRouter automatically
    }
    detectRole();
  }, [session]);

  async function loadRestaurants() {
    const { data } = await supabase.from('restaurants').select('id, name, city, code').order('name');
    setRestaurants(data ?? []);
  }

  async function loadAdminRestaurants(userId: string) {
    const { data } = await supabase
      .from('restaurant_members')
      .select('restaurant_id, restaurants(id, name, city, code)')
      .eq('user_id', userId);
    const list = (data ?? []).map((r: any) => r.restaurants).filter(Boolean);
    setRestaurants(list);
  }

  async function handleRestaurantSelect(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    if (userRole === 'god') {
      // Show all accounts for this restaurant
      setAccountsLoading(true);
      setStep('account_list');
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, photo_url, team')
        .eq('restaurant_id', restaurant.id);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.user_id, r.role]));
      const list: AccountEntry[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        role: roleMap[p.id] ?? 'staff',
        photo_url: p.photo_url,
        team: p.team,
      }));
      // Sort by role hierarchy
      list.sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a.role);
        const bi = ROLE_ORDER.indexOf(b.role);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      setAccounts(list);
      setAccountsLoading(false);
    } else {
      // Admin → redirect directly to dashboard (handled by AppRouter after restaurant selection)
      // For now, just update the restaurant_id on the admin's profile
      if (session) {
        await supabase.from('profiles').update({ restaurant_id: restaurant.id }).eq('id', session.user.id);
        window.location.reload();
      }
    }
  }

  async function handleImpersonate(account: AccountEntry) {
    setImpersonating(true);
    // Store impersonation data in sessionStorage for the GOD banner
    sessionStorage.setItem('god_impersonating', JSON.stringify({
      targetId: account.id,
      targetName: account.name,
      targetRole: account.role,
      restaurantName: selectedRestaurant?.name,
    }));
    // Update god's profile to use this restaurant context
    if (session) {
      await supabase.from('profiles').update({ restaurant_id: selectedRestaurant?.id }).eq('id', session.user.id);
    }
    window.location.reload();
  }

  // Map username aliases to emails
  const USERNAME_MAP: Record<string, string> = {
    god: 'god@staffandb.app',
    rudy: 'rudy@staffandb.app',
    admin: 'rudy@staffandb.app',
    cas_station: 'cas_station@staffandb.app',
  };

  const resolveEmail = (input: string) => {
    const lower = input.trim().toLowerCase();
    return USERNAME_MAP[lower] ?? input.trim();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const resolvedEmail = resolveEmail(email);
    const { error: err } = await signIn(resolvedEmail, password);
    if (err) {
      setError(err.message || 'Identifiant ou mot de passe invalide');
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setStep('login');
    setUserRole(null);
    setRestaurants([]);
    setSelectedRestaurant(null);
    setAccounts([]);
    setEmail('');
    setPassword('');
    setError('');
  };

  const filteredRestaurants = restaurants.filter((r) =>
    r.name.toLowerCase().includes(restaurantSearch.toLowerCase()) ||
    r.code.toLowerCase().includes(restaurantSearch.toLowerCase()) ||
    (r.city ?? '').toLowerCase().includes(restaurantSearch.toLowerCase())
  );

  const groupedAccounts = ROLE_ORDER.reduce((acc, role) => {
    const group = accounts.filter((a) => a.role === role);
    if (group.length > 0) acc[role] = group;
    return acc;
  }, {} as Record<string, AccountEntry[]>);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Logout button — always visible on all steps */}
      {session && step !== 'login' && (
        <button
          onClick={handleSignOut}
          className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:border-primary/40 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      )}
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px] -translate-x-1/4 translate-y-1/4" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <img src={logo} alt="Staff&B" className="h-12 mx-auto mb-2 dark:hidden" />
          <img src={logoDark} alt="Staff&B" className="h-12 mx-auto mb-2 hidden dark:block" />
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">F&amp;B Team Management</p>
        </div>

        {/* ── STEP: Login ── */}
        {step === 'login' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-foreground mb-5">Connexion administrateur</h2>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email ou identifiant</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-slide-up">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Connexion…</>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Accès réservé aux administrateurs et Masters.<br />
              Les comptes staff sont créés par le Master.
            </p>
          </div>
        )}

        {/* ── STEP: Restaurant selection (GOD / Admin) ── */}
        {step === 'restaurant_select' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {userRole === 'god' ? '👁 Mode GOD' : '🏢 Choisir un restaurant'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {userRole === 'god' ? 'Sélectionne un restaurant à gérer' : 'Sélectionne ton établissement'}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déco
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={restaurantSearch}
                onChange={(e) => setRestaurantSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredRestaurants.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Aucun restaurant trouvé</p>
              ) : (
                filteredRestaurants.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRestaurantSelect(r)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border hover:border-primary/40 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.city ?? '—'} · {r.code}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── STEP: Account list (GOD only) ── */}
        {step === 'account_list' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setStep('restaurant_select'); setAccounts([]); setSelectedRestaurant(null); }}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">{selectedRestaurant?.name}</h2>
                <p className="text-xs text-muted-foreground">Choisir un compte à impersonner</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Déco
              </button>
            </div>

            {accountsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun compte dans ce restaurant</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(groupedAccounts).map(([role, group]) => (
                  <div key={role}>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1.5 px-1">
                      {ROLE_LABELS[role] ?? role.toUpperCase()}
                    </p>
                    <div className="space-y-1.5">
                      {group.map((account) => (
                        <div key={account.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary border border-border">
                          {account.photo_url ? (
                            <img src={account.photo_url} alt={account.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <InitialsAvatar name={account.name} />
                          )}
                          <span className="flex-1 text-sm font-medium text-foreground truncate">{account.name}</span>
                          <button
                            onClick={() => handleImpersonate(account)}
                            disabled={impersonating}
                            className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex-shrink-0"
                          >
                            {impersonating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Accéder'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Staff&amp;B © 2026 · v0.1 · Cloud
        </p>
      </div>
    </div>
  );
}
