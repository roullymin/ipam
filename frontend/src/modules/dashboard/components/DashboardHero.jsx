import React from 'react';
import { Activity, BarChart3 } from 'lucide-react';

function MetricBadge({ icon: Icon, label, value, onClick, index }) {
  const content = (
    <>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-sky-600 shadow-sm">
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="dashboard-mini-bars" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <span key={item} style={{ height: `${22 + ((index + item) % 4) * 8}px` }} />
          ))}
        </div>
      </div>
      <div className="mt-4 text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 truncate text-2xl font-black text-slate-950">{value}</div>
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
        <div className="dashboard-status-panel p-5">
          <div className="flex items-center gap-2 text-xs font-black text-sky-700">
            <Activity className="h-4 w-4" />
            {eyebrow}
          </div>
          <h2 className="mt-3 max-w-3xl text-xl font-black leading-snug text-slate-950">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
          <div className="mt-4 space-y-2">
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

        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:border-l xl:border-t-0">
          <div className="col-span-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="text-sm font-black text-slate-900">运行指标概览</div>
              <div className="mt-0.5 text-xs text-slate-500">容量、地址、设备风险按当前数据实时汇总</div>
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
