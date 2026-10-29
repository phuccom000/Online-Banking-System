"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Info, X } from 'lucide-react';

export type Toast = {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  body?: string;
  href?: string;
};

const STYLES = {
  success: { icon: CheckCircle2, color: 'text-emerald-400' },
  error: { icon: AlertTriangle, color: 'text-rose-400' },
  info: { icon: Info, color: 'text-cyan-400' },
};

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, color } = STYLES[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-slide-up gap-3 rounded-xl border border-white/10 bg-[#111726]/95 p-4 shadow-2xl backdrop-blur-md"
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{t.title}</p>
              {t.body && <p className="mt-0.5 break-words text-xs text-slate-400">{t.body}</p>}
              {t.href && (
                <a
                  href={t.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline"
                >
                  View on explorer <ExternalLink size={11} />
                </a>
              )}
            </div>
            <button onClick={() => onDismiss(t.id)} className="text-slate-500 hover:text-white" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
