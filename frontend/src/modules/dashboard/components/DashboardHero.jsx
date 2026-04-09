import React from 'react';

function MetricBadge({ icon: Icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-[24px] border border-sky-100 bg-white/92 px-4 py-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.04)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-[0_20px_42px_rgba(14,165,198,0.12)]"
      type="button"
    >
      <div className="absolute inset-y-0 left-0 w-1 rounded-full bg-gradient-to-b from-cyan-400 via-sky-400 to-emerald-400 opacity-80" />
      <div className="flex items-center gap-2 pl-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-cyan-600" />
        {label}
      </div>
      <div className="mt-2 pl-2 text-xl font-black tracking-tight text-slate-950">{value}</div>
    </button>
  );
}

function SummaryTile({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)] backdrop-blur">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-emerald-50 text-cyan-700 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div>
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
    <section className="relative overflow-hidden rounded-[34px] border border-sky-100/80 bg-[linear-gradient(135deg,#fcfeff_0%,#f2faff_40%,#edf9f7_100%)] px-6 py-7 shadow-[0_30px_72px_rgba(14,165,198,0.08)] md:px-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-cyan-200/22 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-8 h-40 w-40 rounded-full bg-sky-100/35 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-10 h-40 w-40 rounded-full bg-emerald-200/18 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.5)_100%)]" />

      <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[30px] border border-white/90 bg-white/74 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_40px_rgba(15,23,42,0.04)] backdrop-blur-sm md:p-6">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/86 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
            {eyebrow}
          </div>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{description}</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
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
