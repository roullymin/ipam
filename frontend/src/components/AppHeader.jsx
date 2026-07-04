import React from 'react';
import { Activity, Bell, KeyRound, Search, ShieldCheck, Terminal } from 'lucide-react';

import { BRAND } from '../lib/brand';
import { BUILD_INFO, shortCommitLabel } from '../lib/buildInfo';

function HeaderButton({ children, onClick, title, className = '' }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`topbar-chip inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 ${className}`}
      title={title}
    >
      {children}
    </button>
  );
}

export default function AppHeader({
  activeLabel,
  alertCount = 0,
  currentUser,
  currentRoleLabel,
  onOpenAlerts,
  onOpenGlobalSearch,
  onOpenDebug,
  onOpenPasswordChange,
  onOpenSystemStatus,
  overview,
}) {
  const backupCount = overview?.backup?.backup_count ?? 0;
  const qualityCount = overview?.data_quality?.suspected_records ?? 0;

  return (
    <header className="app-topbar z-10 flex min-h-[72px] items-center justify-between gap-4 px-5 py-3 lg:px-6">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{BRAND.workspaceLabel}</div>
        <div className="mt-0.5 truncate text-xl font-black text-slate-950">{activeLabel}</div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onOpenGlobalSearch}
          type="button"
          className="topbar-chip hidden h-10 min-w-[18rem] items-center justify-between gap-3 rounded-lg px-3 text-left md:flex"
          title="打开全局精确搜索"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
            <Search className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <span className="truncate">搜索 IP、设备、机柜、人员、申请单</span>
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-400">
            Ctrl K
          </span>
        </button>

        <HeaderButton onClick={onOpenAlerts} title="打开告警中心" className="hidden lg:inline-flex">
          <Bell className="h-4 w-4 text-amber-500" />
          告警 {alertCount}
        </HeaderButton>

        <HeaderButton onClick={onOpenSystemStatus} title="查看当前部署版本与运行状态" className="hidden md:inline-flex">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          版本 {shortCommitLabel(overview?.backend?.commit || BUILD_INFO.commit)}
        </HeaderButton>

        <HeaderButton onClick={onOpenSystemStatus} title="查看部署检查摘要" className="hidden xl:inline-flex">
          <Activity className="h-4 w-4 text-blue-600" />
          备份 {backupCount} / 乱码 {qualityCount}
        </HeaderButton>

        <div className="hidden min-w-[9rem] rounded-lg border border-slate-200 bg-white px-3 py-2 md:block">
          <div className="truncate text-xs font-bold text-slate-900">{currentUser}</div>
          <div className="truncate text-xs text-slate-500">{currentRoleLabel || '未分配角色'}</div>
        </div>

        <HeaderButton onClick={onOpenPasswordChange} title="修改个人密码">
          <KeyRound className="h-4 w-4" />
          <span className="hidden sm:inline">改密</span>
        </HeaderButton>

        <button
          onClick={onOpenDebug}
          className="topbar-chip flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
          title="打开调试日志"
          type="button"
        >
          <Terminal className="h-4 w-4" />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700">
          {(currentUser || 'U').substring(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
