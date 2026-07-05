import React from 'react';
import { ChevronDown, LogOut, Radar } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';

const NAV_GROUPS = [
  { label: '总览', keys: ['dashboard', 'assets'] },
  { label: '资产资源', keys: ['list', 'dcim', 'vault', 'backup'] },
  { label: '流程协同', keys: ['changes', 'resident'] },
  { label: '治理', keys: ['security', 'users'] },
];

function NavItem({ itemKey, config, activeTab, setActiveTab }) {
  const active = activeTab === itemKey;
  const Icon = config.icon;

  return (
    <button
      key={itemKey}
      onClick={() => setActiveTab(itemKey)}
      className={`group flex h-10 w-full items-center rounded-lg px-3 text-sm transition ${
        active
          ? 'bg-gradient-to-r from-indigo-500 to-sky-500 font-bold text-white shadow-lg shadow-blue-950/20'
          : 'text-blue-50/80 hover:bg-white/10 hover:text-white'
      }`}
      aria-current={active ? 'page' : undefined}
      type="button"
    >
      <Icon className={`mr-3 h-4 w-4 ${active ? 'text-white' : 'text-blue-100/70 group-hover:text-white'}`} />
      <span className="min-w-0 flex-1 truncate text-left">{config.label}</span>
      <ChevronDown className={`h-3.5 w-3.5 -rotate-90 ${active ? 'text-white/90' : 'text-blue-100/50'}`} />
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
    <aside className="app-sidebar z-20 flex w-60 flex-shrink-0 flex-col">
      <div className="px-4 py-4">
        <BrandLockup inverse size="sm" showTagline={false} />
        <div className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-semibold text-blue-50/90">
          <Radar className="h-4 w-4 text-cyan-200" />
          {BRAND.consoleLabel}
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-2.5 pb-3">
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label} className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-blue-100/50">
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
            <section className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-blue-100/50">其他</div>
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

      <div className="p-3">
        <div className="rounded-xl border border-white/10 bg-white/10 p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-xs font-black text-cyan-50">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-white">{currentUser}</div>
              <div className="truncate text-[11px] text-blue-100/60">{currentRoleLabel || '未分配角色'}</div>
            </div>
            <button
              onClick={onLogout}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-blue-50/75 transition hover:border-rose-200/40 hover:bg-rose-500/20 hover:text-white"
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
