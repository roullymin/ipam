import React from 'react';

import {
  PolicyNotesPanel,
  RoleMatrixPanel,
  UserOverview,
  UserTable,
} from '../components';

const formatTime = (value) => {
  if (!value) return '从未登录';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
};

const roleToneMap = {
  admin: 'bg-blue-50 text-blue-700 border-blue-100',
  dc_operator: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  ip_manager: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  auditor: 'bg-amber-50 text-amber-700 border-amber-100',
  guest: 'bg-slate-100 text-slate-600 border-slate-200',
};

const permissionDescriptionMap = {
  admin: '可访问全部模块，并负责账号、权限和安全策略维护。',
  dc_operator: '负责机房、机柜、设备和驻场联动信息的维护。',
  ip_manager: '专注 IP 地址、网段、台账维护和批量导入导出。',
  auditor: '可查看概览、安全和驻场信息，不直接修改生产数据。',
  guest: '保留只读浏览能力，适合领导查看或外围协作场景。',
};

export default function UserManagementView({
  users,
  roleDefinitions,
  currentUsername,
  onCreateUser,
  onOpenEdit,
  onOpenReset,
  onToggleActive,
  onUnlock,
  onDeleteUser,
}) {
  const enabledUsers = users.filter((user) => user.is_active).length;
  const mustChangeUsers = users.filter((user) => user.must_change_password).length;
  const lockedUsers = users.filter((user) => user.locked_until).length;

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <UserOverview
          users={users}
          enabledUsers={enabledUsers}
          mustChangeUsers={mustChangeUsers}
          lockedUsers={lockedUsers}
          onCreateUser={onCreateUser}
        />

        <RoleMatrixPanel
          roleDefinitions={roleDefinitions}
          permissionDescriptionMap={permissionDescriptionMap}
          roleToneMap={roleToneMap}
        />

        <UserTable
          users={users}
          roleDefinitions={roleDefinitions}
          roleToneMap={roleToneMap}
          currentUsername={currentUsername}
          formatTime={formatTime}
          onOpenEdit={onOpenEdit}
          onOpenReset={onOpenReset}
          onToggleActive={onToggleActive}
          onUnlock={onUnlock}
          onDeleteUser={onDeleteUser}
        />

        <PolicyNotesPanel />
      </div>
    </div>
  );
}
