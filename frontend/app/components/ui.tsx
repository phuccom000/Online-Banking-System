"use client";

import React, { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md ${className}`}>
      {children}
    </section>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

const BADGE_TONES = {
  emerald: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/20',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
  slate: 'bg-white/5 text-slate-400 ring-white/10',
  violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
};

export type Tone = keyof typeof BADGE_TONES;

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full animate-slide-up overflow-y-auto rounded-t-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl backdrop-blur-md sm:max-w-md sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  size?: 'sm' | 'md';
};

const VARIANTS = {
  primary:
    'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none',
  secondary: 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:text-slate-500',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white disabled:text-slate-600',
};

export function Button({ variant = 'primary', loading, size = 'md', className = '', children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed ${
        size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3'
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span
        className={`mt-1.5 flex items-center rounded-xl border bg-black/20 px-3 transition focus-within:ring-2 ${
          error ? 'border-rose-500/50 focus-within:ring-rose-500/20' : 'border-white/10 focus-within:border-emerald-500/60 focus-within:ring-emerald-500/15'
        }`}
      >
        <input {...props} className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600" />
        {suffix && <span className="ml-2 text-xs font-medium text-slate-500">{suffix}</span>}
      </span>
      {(error || hint) && <span className={`mt-1 block text-xs ${error ? 'text-rose-400' : 'text-slate-500'}`}>{error ?? hint}</span>}
    </label>
  );
}

export function Row({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone?: 'emerald' | 'rose' | 'amber' }) {
  const color = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : 'text-slate-100';
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`text-right font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-white/15'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
