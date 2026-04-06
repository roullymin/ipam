import React from 'react';

export default function SecuritySummaryCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}
