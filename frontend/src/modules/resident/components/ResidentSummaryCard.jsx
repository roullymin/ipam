import React from 'react';

export default function ResidentSummaryCard({ title, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className={`mt-1 text-xl font-black leading-none ${tone}`}>{value}</div>
    </div>
  );
}
