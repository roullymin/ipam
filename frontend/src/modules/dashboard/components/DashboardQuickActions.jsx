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
            className="dashboard-action-button flex min-h-11 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/60"
            type="button"
          >
            <span>{action.label}</span>
            <ArrowRight className="h-4 w-4 text-blue-600" />
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}
