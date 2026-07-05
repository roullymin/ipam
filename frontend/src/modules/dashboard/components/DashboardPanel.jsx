import React from 'react';

export default function DashboardPanel({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-base font-black text-slate-950">{title}</div>
        <div className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
