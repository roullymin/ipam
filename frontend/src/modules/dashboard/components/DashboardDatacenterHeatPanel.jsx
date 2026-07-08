import React from 'react';

import DashboardPanel from './DashboardPanel';

function MiniStat({ label, value }) {
  return (
    <div className="dashboard-mini-stat rounded-md bg-white px-2.5 py-2">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 font-black text-slate-900">{value}</div>
    </div>
  );
}

export default function DashboardDatacenterHeatPanel({ datacenters, onJumpToDc }) {
  return (
    <DashboardPanel title="站点热度" subtitle="优先把高压力站点推到前面，点开就能进入机房视图。">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {datacenters.map((datacenter) => (
          <button
            key={datacenter.id}
            onClick={() => onJumpToDc?.(datacenter.id)}
            className="dashboard-location-card rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-200 hover:bg-white"
            type="button"
          >
            <div className="text-base font-black text-slate-900">{datacenter.name}</div>
            <div className="mt-1 text-xs text-slate-500">{datacenter.location || '未填写位置'}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <MiniStat label="机柜" value={datacenter.rackCount} />
              <MiniStat label="设备" value={datacenter.deviceCount} />
              <MiniStat label="告警" value={datacenter.warningCount} />
              <MiniStat label="占用" value={`${datacenter.uUtilization}%`} />
            </div>
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}
