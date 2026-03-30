import React from 'react';
import { KeyRound, LayoutGrid, ShieldCheck, Terminal } from 'lucide-react';

export default function AppHeader({
  activeLabel,
  currentUser,
  onOpenDebug,
  onOpenPasswordChange,
}) {
  return (
    <header className="app-topbar z-10 flex h-20 items-center justify-between px-8">
      <div>
        <div className="flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <LayoutGrid className="mr-2 h-3.5 w-3.5" />
          资产管理工作台
        </div>
        <div className="mt-1 text-xl font-bold text-slate-900">{activeLabel}</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 shadow-sm md:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          数据安全优先
        </div>
        <button
          onClick={onOpenPasswordChange}
          className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600"
          title="修改个人密码"
          type="button"
        >
          <KeyRound className="mr-1.5 h-4 w-4" />
          修改密码
        </button>
        <button
          onClick={onOpenDebug}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600"
          title="打开调试日志"
          type="button"
        >
          <Terminal className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-100 text-xs font-bold text-sky-700">
          {(currentUser || 'U').substring(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
