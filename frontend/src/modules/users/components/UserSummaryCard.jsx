import React from 'react';

export default function UserSummaryCard({ title, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className={`mt-3 text-3xl font-black tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}
