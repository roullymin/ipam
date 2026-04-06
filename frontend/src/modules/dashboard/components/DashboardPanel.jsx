import React from 'react';

export default function DashboardPanel({ title, subtitle, children }) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <div className="text-lg font-black tracking-tight text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
