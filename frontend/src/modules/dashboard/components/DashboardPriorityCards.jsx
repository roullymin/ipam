import React from 'react';

import DashboardPanel from './DashboardPanel';

export default function DashboardPriorityCards({ items, onNavigate }) {
  return (
    <DashboardPanel title="今日优先事项" subtitle="把最常用的待办变成可执行入口。">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.title}
            onClick={() => onNavigate?.(item.target)}
            className={`rounded-lg border p-4 text-left transition hover:border-blue-200 ${item.tone}`}
            type="button"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold opacity-80">{item.title}</div>
              <item.icon className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-3 text-2xl font-black">{item.value}</div>
            <div className="mt-1 text-sm leading-5 opacity-90">{item.helper}</div>
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}
