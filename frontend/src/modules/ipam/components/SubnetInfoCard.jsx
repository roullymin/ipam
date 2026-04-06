import React from 'react';

export default function SubnetInfoCard({ title, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{value || '-'}</div>
    </div>
  );
}
