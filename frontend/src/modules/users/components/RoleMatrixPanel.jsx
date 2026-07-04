import React from 'react';

import UserSectionShell from './UserSectionShell';

export default function RoleMatrixPanel({ roleDefinitions, permissionDescriptionMap, roleToneMap }) {
  return (
    <UserSectionShell title="角色与权限矩阵" description="角色标签、权限范围和模块数量统一使用同一套卡片密度与状态色。">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {Object.entries(roleDefinitions).map(([role, meta]) => (
          <div key={role} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">{meta.label}</div>
                <div className="mt-1 text-sm leading-5 text-slate-500">
                  {permissionDescriptionMap[role]}
                </div>
              </div>
              <span
                className={`rounded-md border px-2 py-1 text-xs font-bold ${
                  roleToneMap[role] || roleToneMap.guest
                }`}
              >
                {(meta.permissions || []).length} 个模块
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(meta.permissions || []).map((permission) => (
                <span
                  key={permission}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </UserSectionShell>
  );
}
