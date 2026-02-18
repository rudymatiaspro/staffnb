import { useState, useEffect, useCallback } from 'react';
import { UtensilsCrossed, Delete, Clock, CheckCircle, LogIn, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center select-none">
      <p className="text-7xl font-black text-foreground tabular-nums tracking-tight">
        {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-base text-muted-foreground mt-2 capitalize">
        {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

type StationState = 'idle' | 'confirmed';

export default function Station() {
  const { validateStationPin, clockAction } = useApp();
  const [pin, setPin] = useState('');
  const [state, setState] = useState<StationState>('idle');
  const [result, setResult] = useState<{ name: string; action: 'in' | 'out' } | null>(null);
  const [error, setError] = useState(false);

  const handleKey = useCallback((key: string) => {
    if (state !== 'idle') return;
    if (key === 'clear') { setPin(''); setError(false); return; }
    if (key === 'del') { setPin((p) => p.slice(0, -1)); setError(false); return; }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        const user = validateStationPin(next);
        if (!user) {
          setError(true);
          setPin('');
          setTimeout(() => setError(false), 1500);
          return;
        }
        const action = clockAction(user.id);
        setResult({ name: user.name, action });
        setState('confirmed');
        setTimeout(() => {
          setState('idle');
          setPin('');
          setResult(null);
        }, 4000);
      }, 100);
    }
  }, [pin, state, validateStationPin, clockAction]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      if (e.key === 'Backspace') handleKey('del');
      if (e.key === 'Escape') handleKey('clear');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 select-none">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <UtensilsCrossed className="w-7 h-7 text-primary" />
        </div>
        <p className="text-xl font-black text-foreground tracking-tight">staff&b</p>
        <p className="text-sm text-muted-foreground">Casinha</p>
      </div>

      {/* Clock */}
      <div className="mb-10">
        <LiveClock />
      </div>

      {/* Content: PIN pad or result */}
      {state === 'idle' ? (
        <div className="w-full max-w-xs">
          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? error
                      ? 'bg-red-500 scale-110'
                      : 'bg-primary scale-110'
                    : 'bg-secondary border-2 border-border'
                }`}
              />
            ))}
          </div>
          {error && (
            <p className="text-center text-xs text-timer-danger font-medium mb-3 animate-wiggle">
              Unknown PIN — try again
            </p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                className={`pin-btn ${key === 'clear' ? 'text-xs text-muted-foreground' : ''} ${key === 'del' ? 'text-muted-foreground' : ''}`}
              >
                {key === 'del' ? <Delete className="w-5 h-5 mx-auto" /> : key === 'clear' ? 'CLR' : key}
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Enter your 4-digit PIN to clock in or out
          </p>
        </div>
      ) : (
        /* Confirmation screen */
        <div className="w-full max-w-xs text-center animate-slide-up">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 ${
            result?.action === 'in'
              ? 'bg-emerald-100 border-4 border-emerald-400'
              : 'bg-blue-100 border-4 border-blue-400'
          }`}>
            {result?.action === 'in'
              ? <LogIn className="w-10 h-10 text-emerald-600" />
              : <LogOut className="w-10 h-10 text-blue-600" />}
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">
            {result?.action === 'in'
              ? `Good morning, ${result?.name}!`
              : `See you tomorrow, ${result?.name}!`}
          </h2>
          <p className={`text-base font-semibold mt-2 flex items-center justify-center gap-2 ${
            result?.action === 'in' ? 'text-emerald-600' : 'text-blue-600'
          }`}>
            <CheckCircle className="w-5 h-5" />
            {result?.action === 'in' ? 'Clock In recorded' : 'Clock Out recorded'}
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
