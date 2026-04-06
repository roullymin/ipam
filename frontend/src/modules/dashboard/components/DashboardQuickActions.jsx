import React from 'react';
import { ArrowRight } from 'lucide-react';

import DashboardPanel from './DashboardPanel';

export default function DashboardQuickActions({ title, subtitle, actions, onNavigate }) {
  return (
    <DashboardPanel title={title} subtitle={subtitle}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate?.(action.target)}
            className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50/60"
            type="button"
          >
            <span>{action.label}</span>
            <ArrowRight className="h-4 w-4 text-cyan-600" />
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}
