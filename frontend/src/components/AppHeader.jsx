import React from 'react';
import { Activity, KeyRound, ShieldCheck, Sparkles, Terminal } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';
import { BUILD_INFO, shortCommitLabel } from '../lib/buildInfo';

export default function AppHeader({
  activeLabel,
  currentUser,
  currentRoleLabel,
  onOpenDebug,
  onOpenPasswordChange,
  onOpenSystemStatus,
  overview,
}) {
  const backupCount = overview?.backup?.backup_count ?? 0;
  const qualityCount = overview?.data_quality?.suspected_records ?? 0;

  return (
    <header className="app-topbar z-10 flex min-h-24 items-center justify-between px-5 py-4 md:px-8">
      <div className="min-w-0">
        <div className="mb-2 hidden md:block">
          <BrandLockup size="sm" className="opacity-95" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
          {BRAND.workspaceLabel}
        </div>
        <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{activeLabel}</div>
        <div className="mt-1 text-sm text-slate-500">
          {BRAND.name} / {BRAND.consoleLabel}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={onOpenSystemStatus}
          type="button"
          className="topbar-chip hidden items-center gap-2 rounded-2xl px-3 py-2 text-xs md:flex"
          title="查看当前部署版本与运行状态"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          版本 {shortCommitLabel(overview?.backend?.commit || BUILD_INFO.commit)}
        </button>
        <button
          onClick={onOpenSystemStatus}
          type="button"
          className="topbar-chip hidden items-center gap-2 rounded-2xl px-3 py-2 text-xs lg:flex"
          title="查看部署检查清单"
        >
          <Activity className="h-3.5 w-3.5 text-cyan-600" />
          备份 {backupCount} / 乱码 {qualityCount}
        </button>
        <div className="hidden min-w-[8.5rem] rounded-[22px] border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm md:block">
          <div className="truncate text-xs font-bold text-slate-800">{currentUser}</div>
          <div className="truncate text-[11px] text-slate-500">{currentRoleLabel || '未分配角色'}</div>
        </div>
        <button
          onClick={onOpenPasswordChange}
          className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/85 px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-cyan-200 hover:text-cyan-700"
          title="修改个人密码"
          type="button"
        >
          <KeyRound className="mr-1.5 h-4 w-4" />
          修改密码
        </button>
        <button
          onClick={onOpenDebug}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/85 text-slate-600 shadow-sm transition-colors hover:border-cyan-200 hover:text-cyan-700"
          title="打开调试日志"
          type="button"
        >
          <Terminal className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-xs font-bold text-cyan-700 shadow-sm">
          {(currentUser || 'U').substring(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
