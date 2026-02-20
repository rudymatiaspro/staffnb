import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, LogOut, Search, ArrowLeft, Building2, Users, Delete, Plus, X, RefreshCw, CheckCircle2, UserPlus } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import { supabase } from '../integrations/supabase/client';
import { verifyPin } from '../lib/pinCrypto';
import type { Session } from '@supabase/supabase-js';

function generateCode(name: string): string {
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
  const num = Math.floor(10 + Math.random() * 90);
  return `${prefix}${num}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthStep = 'login' | 'restaurant_select' | 'account_list' | 'station_pin';

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

// ─── Constants ────────────────────────────────────────────────────────────────
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

// Username → email aliases
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

// ─── Empty accounts panel — create Owner + Station ───────────────────────────
function EmptyAccountsPanel({
  restaurant,
  session,
  onCreated,
}: {
  restaurant: Restaurant;
  session: Session | null;
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const ownerEmail = `${restaurant.code.toLowerCase()}@staffnb.app`;
  const stationEmail = `station1${restaurant.code.toLowerCase()}@staffnb.app`;
  const tempPassword = 'F00d!F00d!';

  async function handleCreate() {
    if (!session) return;
    setCreating(true);
    setError('');
    try {
      const token = session.access_token;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

      // Create Owner
      const ownerRes = await fetch(`${base}/manage-account`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create',
          name: `Owner ${restaurant.name}`,
          email: ownerEmail,
          password: tempPassword,
          role: 'owner',
          team: 'MANAGEMENT',
          restaurant_id: restaurant.id,
        }),
      });
      const ownerData = await ownerRes.json();
      if (!ownerData.success) throw new Error(`Owner: ${ownerData.error}`);

      // Assign restaurant_id to owner profile
      await supabase.from('profiles').update({ restaurant_id: restaurant.id }).eq('id', ownerData.userId);

      // Create Station
      const stationRes = await fetch(`${base}/manage-account`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create',
          name: `Station ${restaurant.name}`,
          email: stationEmail,
          password: tempPassword,
          role: 'station',
          team: 'BAR',
          restaurant_id: restaurant.id,
        }),
      });
      const stationData = await stationRes.json();
      if (!stationData.success) throw new Error(`Station: ${stationData.error}`);

      // Assign restaurant_id to station profile
      await supabase.from('profiles').update({ restaurant_id: restaurant.id }).eq('id', stationData.userId);

      setDone(true);
      setTimeout(onCreated, 1200);
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la création des comptes.');
    } finally {
      setCreating(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-8 space-y-3 animate-slide-up">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
        <p className="text-sm font-semibold text-foreground">Comptes créés avec succès !</p>
        <p className="text-xs text-muted-foreground">Chargement de la liste…</p>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4 animate-slide-up">
      <div className="text-center">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Aucun compte dans ce restaurant</p>
        <p className="text-xs text-muted-foreground mt-1">Créez les comptes initiaux avec la nomenclature standard</p>
      </div>

      {/* Preview des comptes à créer */}
      <div className="bg-secondary/60 border border-border rounded-xl p-3 space-y-2.5 text-xs">
        <div className="flex items-start gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Propriétaire</p>
            <p className="text-muted-foreground font-mono">{ownerEmail}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Station (appareil principal)</p>
            <p className="text-muted-foreground font-mono">{stationEmail}</p>
          </div>
        </div>
        <div className="border-t border-border pt-2 mt-1 flex items-center gap-1.5 text-muted-foreground">
          <Lock className="w-3 h-3 flex-shrink-0" />
          <span>Mot de passe temporaire : <span className="font-mono font-semibold text-foreground">F00d!F00d!</span></span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
      >
        {creating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Création en cours…</>
        ) : (
          <><UserPlus className="w-4 h-4" /> Créer les comptes initiaux</>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground/60">Le client devra changer le mot de passe lors de sa première connexion</p>
    </div>
  );
}

// ─── Initials avatar ──────────────────────────────────────────────────────────
function InitialsAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const sz = size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground`}>
      {initials}
    </div>
  );
}

// ─── Station PIN pad (6 digits) ───────────────────────────────────────────────
function StationPinPad({ onSuccess, onBack, accountName, error: externalError }: {
  onSuccess: (pin: string) => void;
  onBack: () => void;
  accountName: string;
  error?: string;
}) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // Reset on external error
  useEffect(() => {
    if (externalError) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setPin('');
    }
  }, [externalError]);

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) {
      setTimeout(() => onSuccess(next), 150);
    }
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));
  const digits = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-bold text-primary">{accountName.slice(0,2).toUpperCase()}</span>
        </div>
        <h2 className="text-lg font-bold text-foreground">{accountName}</h2>
        <p className="text-xs text-muted-foreground mt-1">Station · Entrez votre PIN à 6 chiffres</p>
      </div>

      {/* PIN dots — 6 */}
      <div className={`flex justify-center gap-3 transition-all ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`}>
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-primary scale-125' : 'bg-border'}`} />
        ))}
      </div>

      {externalError && (
        <div className="text-center text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 animate-slide-up">
          {externalError}
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          if (d === 'del') return (
            <button key={i} className="pin-btn" onClick={handleDelete} aria-label="Effacer">
              <Delete className="w-5 h-5" />
            </button>
          );
          return (
            <button key={i} className="pin-btn" onClick={() => handleDigit(d)}>
              <span className="text-xl font-bold">{d}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 hover:underline underline-offset-2">
        ← Déconnexion
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AuthLogin() {
  const { signIn, signOut, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<AuthStep>('login');

  // GOD / Admin flow
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurantsError, setRestaurantsError] = useState('');

  // Add restaurant form
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [newRestaurantForm, setNewRestaurantForm] = useState({
    name: '', code: '', city: '', country: 'Vietnam', address: '', phone: '', email: '', timezone: 'Asia/Ho_Chi_Minh',
  });
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [saveRestaurantError, setSaveRestaurantError] = useState('');

  // Station flow
  const [stationName, setStationName] = useState('');
  const [stationPinHash, setStationPinHash] = useState<string | null>(null);
  const [stationPinSet, setStationPinSet] = useState(false);
  const [stationPinError, setStationPinError] = useState('');

  // ─── Detect role after Supabase auth login ───────────────────────────────
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
        const { data: rests, error: err } = await supabase
          .from('restaurants')
          .select('id, name, city, code')
          .order('name');
        if (err) {
          console.error('loadRestaurants error:', err);
          setRestaurantsError('Impossible de charger les restaurants.');
        } else {
          setRestaurants(rests ?? []);
          // Auto-open form if no restaurants exist
          if ((rests ?? []).length === 0) {
            setShowAddRestaurant(true);
          }
        }
        setStep('restaurant_select');
      } else if (role === 'admin') {
        await loadAdminRestaurants(session!.user.id);
        setStep('restaurant_select');
      } else if (role === 'station') {
        // Station: email login done, now verify 6-digit PIN
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, station_pin_hash, station_pin_set')
          .eq('id', session!.user.id)
          .maybeSingle() as any;
        if (profile) {
          setStationName(profile.name ?? 'Station');
          setStationPinHash(profile.station_pin_hash ?? null);
          setStationPinSet(profile.station_pin_set ?? false);
        }
        setStep('station_pin');
      }
      // owner / manager → AppRouter in Index.tsx handles redirect automatically
    }
    detectRole();
  }, [session]);

  async function loadRestaurants() {
    setRestaurantsLoading(true);
    setRestaurantsError('');
    const { data, error: err } = await supabase
      .from('restaurants')
      .select('id, name, city, code')
      .order('name');
    if (err) {
      console.error('loadRestaurants error:', err);
      setRestaurantsError(`Erreur: ${err.message}`);
    } else {
      setRestaurants(data ?? []);
      if ((data ?? []).length === 0) {
        setShowAddRestaurant(true);
      }
    }
    setRestaurantsLoading(false);
  }

  async function loadAdminRestaurants(userId: string) {
    setRestaurantsLoading(true);
    const { data, error: err } = await supabase
      .from('restaurant_members')
      .select('restaurant_id, restaurants(id, name, city, code)')
      .eq('user_id', userId);
    if (err) console.error('loadAdminRestaurants error:', err);
    const list = (data ?? []).map((r: any) => r.restaurants).filter(Boolean);
    setRestaurants(list);
    setRestaurantsLoading(false);
  }

  async function handleCreateRestaurant() {
    if (!newRestaurantForm.name.trim()) { setSaveRestaurantError('Le nom est requis.'); return; }
    if (!newRestaurantForm.code.trim()) { setSaveRestaurantError('Le code est requis.'); return; }
    setSavingRestaurant(true);
    setSaveRestaurantError('');
    const { error: err } = await supabase.from('restaurants').insert({
      name: newRestaurantForm.name.trim(),
      code: newRestaurantForm.code.trim().toUpperCase(),
      city: newRestaurantForm.city || null,
      country: newRestaurantForm.country,
      address: newRestaurantForm.address || null,
      phone: newRestaurantForm.phone || null,
      email: newRestaurantForm.email || null,
      timezone: newRestaurantForm.timezone,
    });
    if (err) {
      setSaveRestaurantError(err.message.includes('duplicate') ? `Le code "${newRestaurantForm.code.toUpperCase()}" existe déjà.` : err.message);
      setSavingRestaurant(false);
      return;
    }
    setSavingRestaurant(false);
    setShowAddRestaurant(false);
    setNewRestaurantForm({ name: '', code: '', city: '', country: 'Vietnam', address: '', phone: '', email: '', timezone: 'Asia/Ho_Chi_Minh' });
    await loadRestaurants();
  }

  async function handleRestaurantSelect(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    if (userRole === 'god') {
      setAccountsLoading(true);
      setStep('account_list');
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, photo_url, team').eq('restaurant_id', restaurant.id);
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.user_id, r.role]));
      const list: AccountEntry[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        role: roleMap[p.id] ?? 'staff',
        photo_url: p.photo_url,
        team: p.team,
      }));
      list.sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a.role);
        const bi = ROLE_ORDER.indexOf(b.role);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      setAccounts(list);
      setAccountsLoading(false);
    } else {
      // Admin → update restaurant context then reload into dashboard
      if (session) {
        await supabase.from('profiles').update({ restaurant_id: restaurant.id }).eq('id', session.user.id);
        window.location.reload();
      }
    }
  }

  async function handleImpersonate(account: AccountEntry) {
    setImpersonating(true);
    sessionStorage.setItem('god_impersonating', JSON.stringify({
      targetId: account.id,
      targetName: account.name,
      targetRole: account.role,
      restaurantName: selectedRestaurant?.name,
    }));
    if (session) {
      await supabase.from('profiles').update({ restaurant_id: selectedRestaurant?.id }).eq('id', session.user.id);
    }
    window.location.reload();
  }

  // ─── Station PIN verification (6-digit) ──────────────────────────────────
  async function handleStationPin(pin: string) {
    setStationPinError('');
    let valid = false;

    if (!stationPinSet || !stationPinHash) {
      // Default station PIN
      valid = pin === '154154';
    } else if (stationPinHash.includes(':')) {
      const res = await verifyPin(stationPinHash, pin);
      valid = res === 'match';
    } else {
      valid = stationPinHash === pin;
    }

    if (valid) {
      // PIN valid — AppRouter will render <Station /> because session role === 'station'
      window.location.reload();
    } else {
      setStationPinError('PIN incorrect. Réessayez.');
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const resolvedEmail = resolveEmail(email);
    const { error: err } = await signIn(resolvedEmail, password);
    if (err) setError(err.message || 'Identifiant ou mot de passe invalide');
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
    setStationPinError('');
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

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {session && step !== 'login' && step !== 'station_pin' && (
        <button
          onClick={handleSignOut}
          className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:border-primary/40 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      )}

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

        {/* ── STEP: Email + password ── */}
        {step === 'login' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-foreground mb-1">Connexion</h2>
            <p className="text-xs text-muted-foreground mb-5">GOD · Admin · Owner · Manager · Station</p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email ou identifiant</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: admin"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    required
                    autoComplete="username"
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
                    minLength={4}
                    autoComplete="current-password"
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
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Connexion…</> : 'Se connecter'}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-center text-xs text-muted-foreground/60">
                Chef · Staff · Sous-Chef → sélection par nom + PIN 4 chiffres
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Station PIN 6 chiffres ── */}
        {step === 'station_pin' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <StationPinPad
              accountName={stationName}
              onSuccess={handleStationPin}
              onBack={handleSignOut}
              error={stationPinError}
            />
          </div>
        )}

        {/* ── STEP: Sélection restaurant (GOD / Admin) ── */}
        {step === 'restaurant_select' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  {restaurants.length === 0 ? 'Aucun restaurant' : 'Choisir un restaurant'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {restaurants.length} établissement{restaurants.length !== 1 ? 's' : ''}
                  {restaurants.length === 0 && ' · Créez le premier ci-dessous'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={loadRestaurants} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Actualiser">
                  <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${restaurantsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Déco
                </button>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={restaurantSearch}
                onChange={(e) => setRestaurantSearch(e.target.value)}
                placeholder="Rechercher un restaurant…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Erreur */}
            {restaurantsError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">{restaurantsError}</p>
            )}

            {/* Liste des restaurants */}
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {restaurantsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRestaurants.length === 0 ? (
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
                      <p className="text-xs text-muted-foreground">{r.city ?? '—'} · <span className="font-mono">{r.code}</span></p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Bouton Ajouter */}
            {!showAddRestaurant && (
              <button
                onClick={() => {
                  setShowAddRestaurant(true);
                  setNewRestaurantForm({ name: '', code: '', city: '', country: 'Vietnam', address: '', phone: '', email: '', timezone: 'Asia/Ho_Chi_Minh' });
                  setSaveRestaurantError('');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter un restaurant
              </button>
            )}

            {/* Formulaire d'ajout inline */}
            {showAddRestaurant && (
              <div className="border border-primary/20 rounded-xl p-4 space-y-3 bg-primary/5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Nouveau restaurant</p>
                  <button onClick={() => setShowAddRestaurant(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input
                      value={newRestaurantForm.name}
                      onChange={(e) => setNewRestaurantForm((f) => ({ ...f, name: e.target.value, code: f.code || generateCode(e.target.value) }))}
                      placeholder="Nom du restaurant *"
                      className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={newRestaurantForm.code}
                      onChange={(e) => setNewRestaurantForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="Code *"
                      maxLength={8}
                      className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-foreground font-mono text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setNewRestaurantForm((f) => ({ ...f, code: generateCode(f.name) }))}
                      className="p-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                      title="Régénérer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <input
                    value={newRestaurantForm.city}
                    onChange={(e) => setNewRestaurantForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Ville"
                    className="px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                  <div className="col-span-2">
                    <input
                      value={newRestaurantForm.address}
                      onChange={(e) => setNewRestaurantForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Adresse"
                      className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <input
                    value={newRestaurantForm.phone}
                    onChange={(e) => setNewRestaurantForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Téléphone"
                    className="px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    value={newRestaurantForm.email}
                    onChange={(e) => setNewRestaurantForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                    className="px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                {saveRestaurantError && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveRestaurantError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddRestaurant(false)}
                    className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateRestaurant}
                    disabled={savingRestaurant}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingRestaurant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Créer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Liste comptes (GOD uniquement) ── */}
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
              <EmptyAccountsPanel
                restaurant={selectedRestaurant!}
                session={session}
                onCreated={async () => {
                  // Reload accounts
                  setAccountsLoading(true);
                  const { data: profiles } = await supabase
                    .from('profiles').select('id, name, photo_url, team').eq('restaurant_id', selectedRestaurant!.id);
                  const { data: roles } = await supabase.from('user_roles').select('user_id, role');
                  const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.user_id, r.role]));
                  const list: AccountEntry[] = (profiles ?? []).map((p: any) => ({
                    id: p.id, name: p.name, role: roleMap[p.id] ?? 'staff', photo_url: p.photo_url, team: p.team,
                  }));
                  list.sort((a, b) => (ROLE_ORDER.indexOf(a.role) === -1 ? 99 : ROLE_ORDER.indexOf(a.role)) - (ROLE_ORDER.indexOf(b.role) === -1 ? 99 : ROLE_ORDER.indexOf(b.role)));
                  setAccounts(list);
                  setAccountsLoading(false);
                }}
              />
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
