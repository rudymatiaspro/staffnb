import { useState, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Task } from '../../types';
import { Camera, X, CheckCircle, Lock, Loader2, Image } from 'lucide-react';
import { verifyPin, isLegacyHash } from '../../lib/pinCrypto';
import { useApp } from '../../context/AppContext';

interface TaskValidationModalProps {
  task: Task;
  onClose: () => void;
  onValidated: (taskId: string, photoUrl: string) => void;
}

type Step = 'photo' | 'pin' | 'done';

export function TaskValidationModal({ task, onClose, onValidated }: TaskValidationModalProps) {
  const { currentUser } = useApp();
  const [step, setStep] = useState<Step>('photo');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePinDigit = (d: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
    setPinError('');
  };

  const handlePinDelete = () => setPin((p) => p.slice(0, -1));

  const handleValidate = async () => {
    if (!currentUser || pin.length !== 6 || !photoFile) return;
    setUploading(true);
    try {
      // Verify PIN
      const storedHash = currentUser.pin ?? '';
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

      if (!valid) {
        setPinError('PIN incorrect. Réessaie.');
        setPin('');
        setUploading(false);
        return;
      }

      const { data: gamSettings } = await supabase.from('gamification_settings').select('points_with_photo').limit(1).single();
      const pointsWithPhoto = gamSettings?.points_with_photo ?? 2;

      // Upload photo
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const path = `${task.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(path, photoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('task-proofs').getPublicUrl(path);

      // Award photo bonus score event
      if (currentUser && pointsWithPhoto > 0) {
        await supabase.from('score_events').insert({
          user_id: currentUser.id,
          user_name: currentUser.name,
          team: currentUser.team,
          type: 'bonus',
          reason: `📸 Photo proof — ${task.name}`,
          points: pointsWithPhoto,
        });
      }

      onValidated(task.id, publicUrl);
      setStep('done');
    } catch (err) {
      console.error(err);
      setPinError('Erreur lors de la validation. Réessaie.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">Valider la tâche</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{task.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 'done' ? (
            <div className="text-center py-6">
              <CheckCircle className="w-14 h-14 text-primary mx-auto mb-3" />
              <p className="font-bold text-foreground">Tâche validée !</p>
              <p className="text-xs text-muted-foreground mt-1">+{task.points ?? 10} points crédités</p>
              <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                Fermer
              </button>
            </div>
          ) : step === 'photo' ? (
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
                <span className="text-xs font-semibold text-foreground">Photo de preuve</span>
              </div>
              <p className="text-xs text-muted-foreground">Prenez une photo pour prouver que la tâche est terminée.</p>

              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary">
                  <img src={photoPreview} alt="Preuve" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Appareil photo / Galerie</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground">
                  Annuler
                </button>
                <button
                  onClick={() => setStep('pin')}
                  disabled={!photoFile}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Image className="w-3.5 h-3.5" />
                  Suivant
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
                <span className="text-xs font-semibold text-foreground">Confirmer avec votre PIN</span>
              </div>

              {/* PIN dots */}
              <div className="flex justify-center gap-4 my-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pin.length > i ? 'bg-primary border-primary' : 'border-border'
                  }`} />
                ))}
              </div>

              {pinError && (
                <p className="text-xs text-destructive text-center bg-destructive/10 rounded-lg px-3 py-2">{pinError}</p>
              )}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                  <button
                    key={i}
                    onClick={() => d === '⌫' ? handlePinDelete() : d ? handlePinDigit(d) : undefined}
                    className={`h-12 rounded-xl text-base font-semibold transition-all active:scale-95 ${
                      d === '' ? 'invisible' :
                      d === '⌫' ? 'bg-secondary text-muted-foreground hover:bg-muted' :
                      'bg-secondary text-foreground hover:bg-muted'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setStep('photo'); setPin(''); setPinError(''); }} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground">
                  Retour
                </button>
                <button
                  onClick={handleValidate}
                  disabled={pin.length !== 4 || uploading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {uploading ? 'Validation...' : 'Valider'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
