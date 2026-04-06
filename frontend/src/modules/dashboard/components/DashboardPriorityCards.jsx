import React from 'react';

import DashboardPanel from './DashboardPanel';

export default function DashboardPriorityCards({ items, onNavigate }) {
  return (
    <DashboardPanel title="今日优先事项" subtitle="把最常用的待办变成可执行入口。">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.title}
            onClick={() => onNavigate?.(item.target)}
            className={`rounded-[24px] border p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 ${item.tone}`}
            type="button"
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">{item.title}</div>
              <item.icon className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-4 text-4xl font-black tracking-tight">{item.value}</div>
            <div className="mt-2 text-sm leading-6 opacity-90">{item.helper}</div>
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}
