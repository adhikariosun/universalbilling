import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-blue-600 ${className}`} />;
}

export function FullPageSpinner({ message }: { message?: string }): ReactNode {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50">
      <Spinner size={32} />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
      <Spinner size={20} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
