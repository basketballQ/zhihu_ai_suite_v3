import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className="ui-toast">{t.message}</div>
      ))}
    </div>
  );
}
