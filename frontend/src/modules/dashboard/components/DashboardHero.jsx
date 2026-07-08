import React from 'react';
import { Activity, BarChart3 } from 'lucide-react';

function MetricBadge({ icon: Icon, label, value, onClick, index }) {
  const content = (
    <>
      <span className="dashboard-metric-icon flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-sky-600 shadow-sm">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-700">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </>
  );

  if (!onClick) {
    return (
      <div className={`dashboard-alert-row dashboard-alert-row-${index % 4}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`dashboard-alert-row dashboard-alert-row-${index % 4} hover:-translate-y-0.5 hover:shadow-md`}
      type="button"
    >
      {content}
    </button>
  );
}

function SummaryTile({ icon: Icon, label, value, helper, index }) {
  return (
    <div className="dashboard-summary-tile rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="dashboard-summary-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Icon className="h-4 w-4" />
        </div>
        <div className="dashboard-mini-bars dashboard-mini-bars-compact" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <span key={item} style={{ height: `${14 + ((index + item) % 4) * 6}px` }} />
          ))}
        </div>
      </div>
      <div className="mt-3 text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xl font-black text-slate-950">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{helper}</div>
    </div>
  );
}

export default function DashboardHero({
  eyebrow,
  title,
  description,
  metricBadges,
  summaryTiles,
}) {
  return (
    <section className="dashboard-compact-hero overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="dashboard-status-panel rounded-xl border border-slate-100 p-4 xl:w-[42%]">
          <div className="flex items-center gap-2 text-xs font-black text-sky-700">
            <Activity className="h-4 w-4" />
            {eyebrow}
          </div>
          <h2 className="mt-2 max-w-3xl text-lg font-black leading-snug text-slate-950">
            {title}
          </h2>
          <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-600">
            {description}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {metricBadges.map((item, index) => (
              <MetricBadge
                key={item.label}
                icon={item.icon}
                label={item.label}
                value={item.value}
                onClick={item.onClick}
                index={index}
              />
            ))}
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="dashboard-indicator-header col-span-full flex min-h-14 items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm xl:col-span-4">
            <div>
              <div className="text-sm font-black text-slate-900">运行指标概览</div>
              <div className="mt-0.5 text-xs text-slate-500">容量、地址、设备风险按当前数据实时汇总，点击下方模块进入工作区。</div>
            </div>
            <div className="dashboard-line-chart" aria-hidden="true">
              <BarChart3 className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          {summaryTiles.map((item, index) => (
            <SummaryTile
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              helper={item.helper}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
