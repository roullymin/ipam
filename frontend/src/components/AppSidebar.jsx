import React from 'react';
import { LogOut, QrCode, ShieldCheck } from 'lucide-react';

export default function AppSidebar({
  activeTab,
  setActiveTab,
  tabConfig,
  currentPermissions,
  currentUser,
  currentRoleLabel,
  onLogout,
}) {
  const initials = (currentUser || 'U').slice(0, 2).toUpperCase();

  return (
    <aside className="app-sidebar z-20 flex w-72 flex-shrink-0 flex-col">
      <div className="border-b border-white/60 px-6 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900">IP 台账管理系统</h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Operations Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-4">
        {Object.entries(tabConfig).map(([key, config]) => {
          if (!currentPermissions.includes(key)) return null;

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex w-full items-center rounded-2xl px-3.5 py-3 text-sm transition-all ${
                activeTab === key
                  ? 'bg-sky-600 -translate-y-0.5 font-bold text-white shadow-lg shadow-sky-200/70'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
              type="button"
            >
              <config.icon className="mr-3 h-4 w-4" />
              <span className="flex-1 text-left">{config.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-800">{currentUser}</div>
              <div className="truncate text-[11px] text-slate-500">{currentRoleLabel || '未分配角色'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <QrCode className="h-3.5 w-3.5 text-amber-500" />
              驻场登记入口
            </div>
            <div className="mt-1 text-sm font-bold text-slate-800">驻场人员模块已接入</div>
          </div>

          <button
            onClick={onLogout}
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-slate-200 px-3 py-2.5 text-xs text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            type="button"
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出系统
          </button>
        </div>
      </div>
    </aside>
  );
}
