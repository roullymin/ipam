import React from 'react';

import DashboardPanel from './DashboardPanel';

export default function DashboardRecentActivityPanel({ logs, formatActionLabel, formatDateTime }) {
  return (
    <DashboardPanel title="最近动作" subtitle="先判断风险，再深入具体模块。">
      <div className="space-y-3">
        {logs.slice(0, 6).map((log) => (
          <div key={log.id} className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold text-slate-900">{log.username || '未知用户'}</span>
              <span className="text-slate-500">{formatActionLabel(log)}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  String(log.status || '').toLowerCase() === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="font-mono">{log.ip_address || 'unknown-ip'}</span>
              <span>{formatDateTime(log.timestamp)}</span>
            </div>
          </div>
        ))}
        {!logs.length ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            暂时没有近期动作。
          </div>
        ) : null}
      </div>
    </DashboardPanel>
  );
}
