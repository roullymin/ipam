import React from 'react';

import DashboardPanel from './DashboardPanel';

function AdviceCard({ title, body, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white"
      type="button"
    >
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{body}</div>
    </button>
  );
}

export default function DashboardAdvicePanel({ items }) {
  return (
    <DashboardPanel title="运营建议" subtitle="把当前状态翻译成下一步动作。">
      <div className="space-y-3">
        {items.map((item) => (
          <AdviceCard key={item.title} title={item.title} body={item.body} onClick={item.onClick} />
        ))}
      </div>
    </DashboardPanel>
  );
}
