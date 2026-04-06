import React from 'react';

export default function UserActionButton({
  label,
  onClick,
  disabled = false,
  tone = 'default',
  title = '',
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
      : tone === 'warning'
        ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
        : tone === 'success'
          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          : 'border-slate-200 text-slate-700 hover:bg-slate-50';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
          : `bg-white ${toneClass}`
      }`}
      disabled={disabled}
      type="button"
      title={title}
    >
      {label}
    </button>
  );
}
