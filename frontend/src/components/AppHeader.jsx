import React from 'react';
import { Activity, Bell, ChevronDown, KeyRound, Search, ShieldCheck, Terminal } from 'lucide-react';

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
  const versionLabel = shortCommitLabel(overview?.backend?.commit || BUILD_INFO.commit);
  const initials = (currentUser || 'U').substring(0, 2).toUpperCase();

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
          className="topbar-chip hidden h-10 min-w-[20rem] items-center justify-between gap-3 rounded-lg px-3 text-left md:flex xl:min-w-[25rem]"
          title="打开全局搜索"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
            <Search className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <span className="truncate">搜索 IP、设备、机柜、人员、申请单</span>
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-400">
            Ctrl K
          </span>
        </button>

        <HeaderButton onClick={onOpenAlerts} title="打开告警中心">
          <Bell className="h-4 w-4 text-amber-500" />
          告警 {alertCount}
        </HeaderButton>

        <details className="relative">
          <summary className="topbar-chip flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 text-left text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700">
              {initials}
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="block max-w-[8rem] truncate text-xs font-bold text-slate-900">{currentUser}</span>
              <span className="block max-w-[8rem] truncate text-xs text-slate-500">{currentRoleLabel || '未分配角色'}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </summary>

          <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2">
              <div className="truncate text-sm font-black text-slate-950">{currentUser}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{currentRoleLabel || '未分配角色'}</div>
            </div>

            <button
              onClick={onOpenSystemStatus}
              type="button"
              className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="min-w-0 flex-1">
                <span className="block">系统状态</span>
                <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
                  版本 {versionLabel} / 备份 {backupCount} / 乱码 {qualityCount}
                </span>
              </span>
            </button>

            <button
              onClick={onOpenPasswordChange}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            >
              <KeyRound className="h-4 w-4 text-slate-500" />
              修改密码
            </button>

            <button
              onClick={onOpenDebug}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            >
              <Terminal className="h-4 w-4 text-slate-500" />
              调试日志
            </button>

            <button
              onClick={onOpenSystemStatus}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            >
              <Activity className="h-4 w-4 text-blue-600" />
              部署检查
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
