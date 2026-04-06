import React from 'react';
import { Search } from 'lucide-react';

export default function ListToolbar({
  eyebrow = '',
  title,
  description = '',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = '搜索',
  resultSummary = '',
  filters = null,
  actions = null,
  children = null,
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                {eyebrow}
              </div>
            ) : null}
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            {onSearchChange ? (
              <div className="relative w-full lg:max-w-[420px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            ) : null}
            {filters ? <div className="flex flex-wrap items-center gap-2.5">{filters}</div> : null}
          </div>

          {resultSummary ? (
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {resultSummary}
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
