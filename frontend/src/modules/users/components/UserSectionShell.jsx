import React from 'react';

export default function UserSectionShell({ title, description, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-base font-black text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-5 text-slate-500">{description}</div>
      </div>
      {children}
    </section>
  );
}
