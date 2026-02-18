import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, Zap, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export default function AuthLogin() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'setup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message || 'Invalid email or password');
    }
    setLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    const { error: err } = await signUp(email, password, name.trim());
    if (err) {
      setError(err.message || 'Could not create account');
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
          <div className="relative inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-primary-foreground" />
            <Zap className="absolute -top-1.5 -right-1.5 w-5 h-5 text-accent fill-accent" />
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">
            Staff<span className="text-accent">&amp;</span>B
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">Casinha · Team Management</p>
        </div>

        <div className="glass-card rounded-2xl p-6 shadow-xl">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-5">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('setup'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'setup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={mode === 'signin' ? handleSignIn : handleSetup} className="space-y-4">
            {mode === 'setup' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lena"
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@casinha.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Please wait…</>
              ) : mode === 'signin' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {mode === 'setup' && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              The first account created becomes the <span className="text-primary font-semibold">Owner</span>.<br />
              Contact your manager to get access if you're staff.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Staff&B © {new Date().getFullYear()} · v2.0 · Cloud
        </p>
      </div>
    </div>
  );
}
