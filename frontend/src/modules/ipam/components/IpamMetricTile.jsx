import React from 'react';

export default function IpamMetricTile({ icon: Icon, label, value, unit = '', accent = 'default' }) {
  const accentClass = {
    default: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-[20px] border px-4 py-4 shadow-sm ${accentClass[accent] || accentClass.default}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-[30px] font-black leading-none">{value}</span>
        {unit ? <span className="pb-1 text-base font-bold opacity-60">{unit}</span> : null}
      </div>
    </div>
  );
}
