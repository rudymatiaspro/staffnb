import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Shield, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { hashPin, verifyPin } from '../../lib/pinCrypto';
import { logAudit } from '../../lib/auditLogger';

export function ChangePinSection() {
  const { currentUser } = useApp();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);
    if (!currentUser) return;
    if (oldPin.length !== 6 || !/^\d{6}$/.test(oldPin)) { setError('L\'ancien PIN doit être 6 chiffres'); return; }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) { setError('Le nouveau PIN doit être 6 chiffres'); return; }
    if (newPin !== confirmPin) { setError('Les PINs ne correspondent pas'); return; }
    if (newPin === '000111') { setError('Impossible d\'utiliser le PIN par défaut 000111'); return; }

    setLoading(true);
    try {
      // Verify old PIN
      const storedHash = currentUser.pin ?? '';
      let oldOk = false;
      if (!storedHash) {
        oldOk = oldPin === '1111';
      } else {
        const res = await verifyPin(storedHash, oldPin);
        // legacy btoa: compare directly
        if (res === 'legacy') {
          oldOk = storedHash === btoa(oldPin);
        } else {
          oldOk = res === 'match';
        }
      }

      if (!oldOk) {
        setError('Ancien PIN incorrect');
        setLoading(false);
        return;
      }

      // Hash new PIN with PBKDF2
      const newHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ pin_hash: newHash, pin_set: true })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      await logAudit(currentUser.id, currentUser.name, 'pin_changed');
      setSuccess(true);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      setError('Erreur lors du changement de PIN');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const PinInput = ({
    label, value, onChange, show, onToggle, placeholder,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; placeholder: string;
  }) => (
    <div>
      <label className="text-xs font-medium text-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder={placeholder}
          className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground placeholder:font-sans placeholder:tracking-normal"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Changer mon PIN</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Votre PIN est haché avec PBKDF2 (SHA-256, 100 000 itérations).
      </p>

      <PinInput
        label="Ancien PIN"
        value={oldPin}
        onChange={setOldPin}
        show={showOld}
        onToggle={() => setShowOld(v => !v)}
        placeholder="••••"
      />
      <PinInput
        label="Nouveau PIN"
        value={newPin}
        onChange={setNewPin}
        show={showNew}
        onToggle={() => setShowNew(v => !v)}
        placeholder="••••"
      />
      <PinInput
        label="Confirmer le nouveau PIN"
        value={confirmPin}
        onChange={setConfirmPin}
        show={showNew}
        onToggle={() => setShowNew(v => !v)}
        placeholder="••••"
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--timer-safe))] bg-[hsl(var(--timer-safe)/0.1)] px-3 py-2 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> PIN changé avec succès !
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !oldPin || !newPin || !confirmPin}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {loading ? 'Changement en cours…' : 'Changer mon PIN'}
      </button>
    </div>
  );
}
