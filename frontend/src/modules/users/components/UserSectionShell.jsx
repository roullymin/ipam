import React from 'react';

export default function UserSectionShell({ title, description, children }) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <div className="text-lg font-black tracking-tight text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div>
      </div>
      {children}
    </section>
  );
}
