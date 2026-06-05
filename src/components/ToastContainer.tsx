import { Toast } from '../hooks/useToast';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const ICONS: Record<Toast['type'], string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
};

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}${toast.exiting ? ' toast--exiting' : ''}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
        >
          <span className="toast__icon">{ICONS[toast.type]}</span>
          <span className="toast__message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
