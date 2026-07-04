import React from 'react';

function MetricBadge({ icon: Icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
      type="button"
    >
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <Icon className="h-4 w-4 text-blue-600" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-xl font-black text-slate-950">{value}</div>
    </button>
  );
}

function SummaryTile({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-slate-500">{label}</div>
        <Icon className="h-5 w-5 text-blue-700" />
      </div>
      <div className="mt-3 truncate text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 truncate text-sm text-slate-500">{helper}</div>
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 lg:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <div className="min-w-0">
          <div className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            {eyebrow}
          </div>
          <h2 className="mt-3 max-w-4xl text-2xl font-black leading-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {description}
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {metricBadges.map((item) => (
              <MetricBadge
                key={item.label}
                icon={item.icon}
                label={item.label}
                value={item.value}
                onClick={item.onClick}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {summaryTiles.map((item) => (
            <SummaryTile
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              helper={item.helper}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
