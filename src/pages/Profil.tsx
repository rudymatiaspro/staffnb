import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import { Camera, User, Phone, Calendar, Shield, Check, Loader2, X } from 'lucide-react';
import { hashPin, verifyPin, isLegacyHash } from '../lib/pinCrypto';

const ROLE_LABELS: Record<string, string> = {
  god: 'Administrateur',
  owner: 'Propriétaire',
  manager: 'Manager',
  chef: 'Chef de Cuisine',
  staff: 'Staff',
  admin: 'Administrateur',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function Profil() {
  const { currentUser, updateUser } = useApp();
  const [phone, setPhone] = useState(currentUser?.['phone'] as string ?? '');
  const [birthDate, setBirthDate] = useState(currentUser?.['birth_date'] as string ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.photo ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  // PIN change
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [pinError, setPinError] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  if (!currentUser) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${currentUser.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', currentUser.id);
      if (updateUser) updateUser({ ...currentUser, photo: publicUrl });
    }
    setAvatarUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ phone, birth_date: birthDate || null }).eq('id', currentUser.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePinDigit = (d: string, setter: (fn: (prev: string) => string) => void) => {
    setter((prev) => prev.length < 4 ? prev + d : prev);
  };

  const handlePinValidate = async () => {
    if (pinStep === 'old') {
      // Verify old PIN
      const storedHash = currentUser.pin ?? '';
      let valid = false;
      if (!storedHash) valid = oldPin === '1111';
      else if (storedHash.includes(':')) valid = (await verifyPin(storedHash, oldPin)) === 'match';
      else if (isLegacyHash(storedHash)) valid = storedHash === btoa(oldPin);
      else valid = storedHash === oldPin;

      if (!valid) { setPinError('PIN actuel incorrect.'); setOldPin(''); return; }
      setPinError('');
      setPinStep('new');
    } else if (pinStep === 'new') {
      if (newPin.length !== 4) return;
      setPinStep('confirm');
    } else {
      // confirm
      if (confirmPin !== newPin) { setPinError('Les PINs ne correspondent pas.'); setConfirmPin(''); return; }
      setPinSaving(true);
      const hash = await hashPin(newPin);
      await supabase.functions.invoke('update-pin', { body: { profileId: currentUser.id, pinHash: hash, pinSet: true } });
      setPinSaving(false);
      setPinSaved(true);
      setTimeout(() => { setShowPinChange(false); setPinStep('old'); setOldPin(''); setNewPin(''); setConfirmPin(''); setPinSaved(false); }, 2000);
    }
  };

  const activePinValue = pinStep === 'old' ? oldPin : pinStep === 'new' ? newPin : confirmPin;
  const activePinSetter = pinStep === 'old' ? setOldPin : pinStep === 'new' ? setNewPin : setConfirmPin;

  const pinStepLabel = pinStep === 'old' ? 'Saisir votre PIN actuel' : pinStep === 'new' ? 'Choisir un nouveau PIN' : 'Confirmer le nouveau PIN';

  return (
    <div className="space-y-5 px-4 pt-2 pb-8">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-black text-primary-foreground border-2 border-border">
              {getInitials(currentUser.name)}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-card"
          >
            {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-foreground">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</p>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Informations personnelles</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Name (read-only) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Prénom &amp; Nom</label>
            <div className="px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground font-medium">{currentUser.name}</div>
          </div>

          {/* Role (read-only) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Rôle</label>
            <div className="px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground font-medium">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Birth date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date de naissance
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Sauvegardé !' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Sécurité</span>
        </div>
        <div className="p-4">
          {!showPinChange ? (
            <button
              onClick={() => setShowPinChange(true)}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
            >
              <Shield className="w-3.5 h-3.5" />
              Changer mon PIN
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{pinStepLabel}</p>
                <button onClick={() => { setShowPinChange(false); setPinStep('old'); setOldPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); }} className="p-1 rounded-lg hover:bg-secondary">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {pinSaved ? (
                <div className="text-center py-4">
                  <Check className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-foreground">PIN mis à jour !</p>
                </div>
              ) : (
                <>
                  {/* PIN dots */}
                  <div className="flex justify-center gap-4">
                    {[0,1,2,3].map((i) => (
                      <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${activePinValue.length > i ? 'bg-primary border-primary' : 'border-border'}`} />
                    ))}
                  </div>

                  {pinError && <p className="text-xs text-destructive text-center">{pinError}</p>}

                  {/* Numpad */}
                  <div className="grid grid-cols-3 gap-2">
                    {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                      <button
                        key={i}
                        onClick={() => d === '⌫' ? activePinSetter((p) => p.slice(0,-1)) : d ? handlePinDigit(d, activePinSetter) : undefined}
                        className={`h-12 rounded-xl text-base font-semibold transition-all active:scale-95 ${d === '' ? 'invisible' : 'bg-secondary text-foreground hover:bg-muted'}`}
                      >{d}</button>
                    ))}
                  </div>

                  <button
                    onClick={handlePinValidate}
                    disabled={activePinValue.length !== 4 || pinSaving}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {pinSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {pinStep === 'confirm' ? 'Confirmer' : 'Suivant'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
