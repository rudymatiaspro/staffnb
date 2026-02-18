import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { NameSelector } from '../components/auth/NameSelector';
import { PinEntry } from '../components/auth/PinEntry';
import { UtensilsCrossed } from 'lucide-react';

export default function Login() {
  const { login, setPin, validatePin, users } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setError('');
  };

  const handlePinSuccess = (pin: string) => {
    if (!selectedUser) return;

    if (!selectedUser.pinSet) {
      // First time - set the PIN
      setPin(selectedUser.id, pin);
      // Get the updated user
      const updatedUser = { ...selectedUser, pin, pinSet: true };
      login(updatedUser);
    } else {
      // Validate PIN
      const valid = validatePin(selectedUser.id, pin);
      if (valid) {
        login(selectedUser);
      } else {
        setError('PIN incorrect. Réessayez.');
        setSelectedUser(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-zone-atelier/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Casinha</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manager · Restaurant</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          {!selectedUser ? (
            <>
              <h2 className="text-lg font-semibold text-foreground">Qui êtes-vous ?</h2>
              <NameSelector onSelect={handleUserSelect} />
              {error && (
                <p className="text-center text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          ) : (
            <PinEntry
              user={selectedUser}
              isFirstTime={!selectedUser.pinSet}
              onSuccess={handlePinSuccess}
              onBack={() => {
                setSelectedUser(null);
                setError('');
              }}
            />
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Casinha Manager © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
