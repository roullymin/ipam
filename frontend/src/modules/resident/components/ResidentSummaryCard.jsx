import React from 'react';

export default function ResidentSummaryCard({ title, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className={`mt-3 text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}
