import React from 'react';
import { ChevronDown, LogOut, Radar } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';

const NAV_GROUPS = [
  { label: '总览', keys: ['dashboard', 'assets'] },
  { label: '资源', keys: ['list', 'dcim', 'vault', 'backup', 'ansible'] },
  { label: '流程', keys: ['changes', 'resident'] },
  { label: '治理', keys: ['security', 'users'] },
];

function NavItem({ itemKey, config, activeTab, setActiveTab }) {
  const active = activeTab === itemKey;
  const Icon = config.icon;

  return (
    <button
      key={itemKey}
      onClick={() => setActiveTab(itemKey)}
      className={`group flex h-11 w-full items-center rounded-xl px-3 text-sm transition ${
        active
          ? 'bg-blue-50 font-black text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,87,246,0.10)]'
          : 'font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-950'
      }`}
      aria-current={active ? 'page' : undefined}
      type="button"
    >
      <span
        className={`mr-3 flex h-8 w-8 items-center justify-center rounded-lg transition ${
          active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 group-hover:bg-white group-hover:text-blue-700'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{config.label}</span>
      <ChevronDown className={`h-3.5 w-3.5 -rotate-90 ${active ? 'text-blue-500' : 'text-slate-300'}`} />
    </button>
  );
}

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
  const renderedKeys = new Set();

  const groups = NAV_GROUPS
    .map((group) => {
      const items = group.keys.filter((key) => {
        const visible = Boolean(tabConfig[key]) && currentPermissions.includes(key);
        if (visible) renderedKeys.add(key);
        return visible;
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  const fallbackItems = Object.keys(tabConfig).filter(
    (key) => currentPermissions.includes(key) && !renderedKeys.has(key),
  );

  return (
    <aside className="app-sidebar z-20 flex w-64 flex-shrink-0 flex-col">
      <div className="px-6 pb-5 pt-6">
        <BrandLockup size="sm" showTagline={false} />
        <div className="mt-6 flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 text-xs font-black text-blue-700">
          <Radar className="h-4 w-4 text-blue-600" />
          {BRAND.consoleLabel}
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-1.5">
              <div className="px-3 pb-1 text-xs font-black text-slate-400">
                {group.label}
              </div>
              {group.items.map((key) => (
                <NavItem
                  key={key}
                  itemKey={key}
                  config={tabConfig[key]}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              ))}
            </section>
          ))}

          {fallbackItems.length > 0 ? (
            <section className="space-y-1.5">
              <div className="px-3 pb-1 text-xs font-black text-slate-400">其他</div>
              {fallbackItems.map((key) => (
                <NavItem
                  key={key}
                  itemKey={key}
                  config={tabConfig[key]}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              ))}
            </section>
          ) : null}
        </div>
      </nav>

      <div className="p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700 ring-1 ring-blue-100">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950">{currentUser}</div>
              <div className="truncate text-xs font-semibold text-slate-500">{currentRoleLabel || '未分配角色'}</div>
            </div>
            <button
              onClick={onLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title="退出系统"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
