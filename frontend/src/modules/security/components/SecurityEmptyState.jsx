import React from 'react';

export default function SecurityEmptyState({ text }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
