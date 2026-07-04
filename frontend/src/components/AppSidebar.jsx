import React from 'react';
import { ChevronRight, LogOut, Radar } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';

const NAV_GROUPS = [
  { label: '总览', keys: ['dashboard', 'assets'] },
  { label: '资源', keys: ['list', 'dcim', 'vault', 'backup'] },
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
      className={`group flex h-10 w-full items-center rounded-lg border px-3 text-sm transition ${
        active
          ? 'border-blue-400/30 bg-blue-500/18 font-bold text-white'
          : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/7 hover:text-white'
      }`}
      aria-current={active ? 'page' : undefined}
      type="button"
    >
      <Icon className={`mr-3 h-4 w-4 ${active ? 'text-blue-200' : 'text-slate-400 group-hover:text-blue-200'}`} />
      <span className="min-w-0 flex-1 truncate text-left">{config.label}</span>
      <ChevronRight className={`h-4 w-4 ${active ? 'text-blue-100' : 'text-slate-600 group-hover:text-slate-300'}`} />
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
    <aside className="app-sidebar z-20 flex w-72 flex-shrink-0 flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <BrandLockup inverse size="sm" showTagline />
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
          <Radar className="h-4 w-4 text-blue-300" />
          {BRAND.consoleLabel}
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label} className="space-y-1.5">
              <div className="px-3 text-xs font-bold text-slate-500">{group.label}</div>
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
              <div className="px-3 text-xs font-bold text-slate-500">其他</div>
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

      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-300/20 bg-blue-500/12 text-sm font-bold text-blue-100">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{currentUser}</div>
              <div className="truncate text-xs text-slate-400">{currentRoleLabel || '未分配角色'}</div>
            </div>
            <button
              onClick={onLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-red-300/30 hover:bg-red-500/10 hover:text-red-100"
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
