import React from 'react';

function MetricBadge({ icon: Icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[22px] border border-white/14 bg-white/8 px-4 py-3 text-left text-white transition-colors hover:bg-white/12"
      type="button"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-black tracking-tight">{value}</div>
    </button>
  );
}

function SummaryTile({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/6 p-5 text-white">
      <Icon className="h-5 w-5 text-cyan-200" />
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/70">{label}</div>
      <div className="mt-1 text-3xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-300/75">{helper}</div>
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
    <section className="overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(135deg,#071828_0%,#0b2136_52%,#0d3554_100%)] px-6 py-7 shadow-[0_30px_65px_rgba(8,24,43,0.18)] md:px-8">
      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div>
          <div className="inline-flex items-center rounded-full border border-cyan-300/16 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
            {eyebrow}
          </div>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white md:text-4xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/82 md:text-base">{description}</p>
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
