import React from 'react';

import DashboardPanel from './DashboardPanel';

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 font-black text-slate-900">{value}</div>
    </div>
  );
}

export default function DashboardDatacenterHeatPanel({ datacenters, onJumpToDc }) {
  return (
    <DashboardPanel title="站点热度" subtitle="优先把高压力站点推到前面，点开就能进入机房视图。">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {datacenters.map((datacenter) => (
          <button
            key={datacenter.id}
            onClick={() => onJumpToDc?.(datacenter.id)}
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white"
            type="button"
          >
            <div className="text-lg font-black tracking-tight text-slate-900">{datacenter.name}</div>
            <div className="mt-1 text-xs text-slate-500">{datacenter.location || '未填写位置'}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
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
