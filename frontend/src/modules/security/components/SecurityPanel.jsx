import React from 'react';

export default function SecurityPanel({ icon: Icon, iconTone, title, description, action = null, children }) {
  return (
    <section className="flex h-[680px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <div className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-sm ${iconTone}`}>
              <Icon className="h-4 w-4" />
            </div>
            {title}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}
