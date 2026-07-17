import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false
}: ConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmLockRef = useRef(false);

  const handleConfirm = async () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // El consumidor muestra el error y el modal permanece abierto para reintentar o cancelar.
    } finally {
      confirmLockRef.current = false;
      setIsConfirming(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !isConfirming && onClose()} title={title}>
      <div className="flex flex-col items-center text-center space-y-4 pt-2">
        <div className={`p-4 rounded-full ${isDestructive ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-medium">
          {message}
        </p>
        {details && details.length > 0 && (
          <div className="w-full text-left bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/20 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-black uppercase tracking-widest text-red-500 dark:text-red-400 mb-2">Se eliminará permanentemente:</p>
            {details.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pt-6 flex justify-end space-x-3">
        <Button variant="outline" onClick={onClose} disabled={isConfirming} className="dark:text-slate-300 dark:hover:bg-slate-800">
          {cancelText}
        </Button>
        <Button 
          variant={isDestructive ? 'destructive' : 'primary'}
          onClick={handleConfirm}
          disabled={isConfirming}
          aria-busy={isConfirming}
        >
          {isConfirming && <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />}
          {isConfirming ? 'Procesando...' : confirmText}
        </Button>
      </div>
    </Modal>
  );
}
