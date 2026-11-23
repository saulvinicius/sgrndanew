import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Ban, X } from 'lucide-react';
import { getStatusLabel } from '../../lib/format.ts';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168653] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants: Record<string, string> = {
    primary: 'bg-[#168653] text-white hover:bg-[#116B45]',
    secondary: 'bg-white text-[#252D29] border border-[#D4DDD8] hover:bg-[#F5F7F6]',
    ghost: 'bg-transparent text-[#252D29] hover:bg-[#E8F7EF] hover:text-[#116B45]',
    danger: 'bg-[#E5484D] text-white hover:bg-[#C9363B]',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-2 text-xs min-h-[36px]',
    md: 'px-4 py-2.5 text-sm min-h-[40px]',
    lg: 'px-6 py-3 text-base min-h-[44px]',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatusIndicator({ status }: { status: string }) {
  const label = getStatusLabel(status);

  if (status === 'confirmed' || status === 'completed' || status === 'active' || status === 'authorized' || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#116B45] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#36B779] shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === 'cancelled' || status === 'no_show' || status === 'suspended' || status === 'rejected' || status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E5484D] whitespace-nowrap">
        <Ban className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#252D29]/75 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-[#252D29]/60 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function AvatarImage({
  src,
  alt,
  name,
  className = 'w-12 h-12 rounded-lg',
}: {
  src?: string;
  alt: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className={`${className} bg-[#E8F7EF] text-[#116B45] flex items-center justify-center font-display font-semibold text-sm border border-[#CBEAD9] shrink-0`}
      >
        {initials || 'AF'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover border border-[#E2E8E5] shrink-0`}
    />
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando dados">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 w-full rounded-lg bg-[#E9EFEC] animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#DCE4DF] bg-white p-8 text-center">
      <h3 className="font-display text-base font-semibold text-[#252D29]">{title}</h3>
      <p className="mt-1.5 text-sm text-[#252D29]/70 max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-[#DCE4DF] shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EEEC]">
          <h3 className="font-display text-lg font-semibold text-[#116B45]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 rounded-lg text-[#252D29]/60 hover:text-[#252D29] hover:bg-[#F5F7F6]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function InlineAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
        tone === 'error'
          ? 'border-[#E5484D]/35 bg-[#E5484D]/5 text-[#252D29]'
          : 'border-[#36B779]/40 bg-[#E8F7EF] text-[#116B45]'
      }`}
    >
      {tone === 'error' ? (
        <AlertCircle className="w-4 h-4 text-[#E5484D] shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-[#168653] shrink-0 mt-0.5" />
      )}
      <div>{children}</div>
    </div>
  );
}
