import React from 'react';
import { ChevronRight, LogOut, Radar, QrCode } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';
import { BUILD_INFO, shortCommitLabel } from '../lib/buildInfo';

export default function AppSidebar({
  activeTab,
  setActiveTab,
  tabConfig,
  currentPermissions,
  currentUser,
  currentRoleLabel,
  onLogout,
  overview,
}) {
  const initials = (currentUser || 'U').slice(0, 2).toUpperCase();
  const backendVersion = overview?.backend?.version || '未获取';
  const backendCommit = shortCommitLabel(overview?.backend?.commit);

  return (
    <aside className="app-sidebar z-20 flex w-80 flex-shrink-0 flex-col">
      <div className="border-b border-white/10 px-6 pb-6 pt-6">
        <BrandLockup inverse size="md" showTagline />
      </div>

      <div className="px-5 pt-5">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
            <Radar className="h-3.5 w-3.5 text-cyan-300" />
            {BRAND.consoleLabel}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-200/88">
            统一纳管网络地址、机房设备、驻场流程与审计轨迹。
          </div>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-5">
        {Object.entries(tabConfig).map(([key, config]) => {
          if (!currentPermissions.includes(key)) return null;

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`group flex w-full items-center rounded-[24px] px-4 py-3.5 text-sm transition-all ${
                activeTab === key
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 -translate-y-0.5 font-bold text-white shadow-[0_16px_28px_rgba(14,165,233,0.28)]'
                  : 'border border-transparent text-slate-300 hover:border-white/8 hover:bg-white/6 hover:text-white'
              }`}
              type="button"
            >
              <config.icon className={`mr-3 h-4 w-4 ${activeTab === key ? 'text-white' : 'text-cyan-200/80'}`} />
              <span className="flex-1 text-left">{config.label}</span>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${
                  activeTab === key ? 'translate-x-0 text-white/90' : 'translate-x-1 text-slate-500 group-hover:text-cyan-200'
                }`}
              />
            </button>
          );
        })}

        {currentPermissions.includes('changes') && !tabConfig.changes ? (
          <button
            onClick={() => setActiveTab('changes')}
            className={`group flex w-full items-center rounded-[24px] px-4 py-3.5 text-sm transition-all ${
              activeTab === 'changes'
                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 -translate-y-0.5 font-bold text-white shadow-[0_16px_28px_rgba(14,165,233,0.28)]'
                : 'border border-transparent text-slate-300 hover:border-white/8 hover:bg-white/6 hover:text-white'
            }`}
            type="button"
          >
            <ChevronRight className={`mr-3 h-4 w-4 rotate-[-90deg] ${activeTab === 'changes' ? 'text-white' : 'text-cyan-200/80'}`} />
            <span className="flex-1 text-left">设备变更 / 机柜申请</span>
            <ChevronRight
              className={`h-4 w-4 transition-transform ${
                activeTab === 'changes' ? 'translate-x-0 text-white/90' : 'translate-x-1 text-slate-500 group-hover:text-cyan-200'
              }`}
            />
          </button>
        ) : null}
      </nav>

      <div className="px-5 pb-5">
        <div className="rounded-[30px] border border-white/10 bg-white/6 p-4 shadow-[0_18px_30px_rgba(4,11,23,0.16)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/12 text-sm font-bold text-cyan-100">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{currentUser}</div>
              <div className="truncate text-[11px] text-slate-300/80">{currentRoleLabel || '未分配角色'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-slate-950/18 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-100">
              <QrCode className="h-3.5 w-3.5 text-amber-300" />
              快速入口
            </div>
            <div className="mt-1 text-sm font-bold text-white">驻场登记已接入统一流程</div>
            <div className="mt-1 text-xs leading-5 text-slate-300/75">
              适合前台登记、审批导出和设备备案统一衔接。
            </div>
          </div>

          <button
            onClick={onLogout}
            className="mt-4 flex w-full items-center justify-center rounded-[22px] border border-white/12 px-3 py-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-red-500/12 hover:text-red-100"
            type="button"
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出系统
          </button>

          <div className="mt-4 border-t border-white/8 pt-3 text-[11px] leading-5 text-slate-400/80">
            <div>前端版本 {BUILD_INFO.version}</div>
            <div>构建提交 {shortCommitLabel(BUILD_INFO.commit)}</div>
            <div>后端版本 {backendVersion}</div>
            <div>后端提交 {backendCommit}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
