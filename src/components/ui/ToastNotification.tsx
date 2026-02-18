import { useApp } from '../../context/AppContext';
import { useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export function ToastNotification() {
  const { toast, clearToast } = useApp();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-timer-safe flex-shrink-0" />,
    error: <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-primary flex-shrink-0" />,
    malus: <AlertTriangle className="w-4 h-4 text-timer-danger flex-shrink-0" />,
  };

  const borderColors = {
    success: 'border-timer-safe/30',
    error: 'border-destructive/30',
    info: 'border-primary/30',
    malus: 'border-timer-danger/30',
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl glass-card border shadow-2xl min-w-[260px] max-w-[380px] ${borderColors[toast.type]}`}
      >
        {icons[toast.type]}
        <p className="text-sm font-medium text-foreground flex-1">{toast.message}</p>
        <button onClick={clearToast} className="text-muted-foreground hover:text-foreground transition-colors ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
