import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';

export default function AuthLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Map username aliases to emails (for god / shared accounts)
  const USERNAME_MAP: Record<string, string> = {
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
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

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Staff&amp;B © 2026 · v0.1 · Cloud
        </p>
      </div>
    </div>
  );
}
