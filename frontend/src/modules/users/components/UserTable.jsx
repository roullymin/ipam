import React from 'react';
import { ShieldCheck } from 'lucide-react';

import { StatusBadge } from '../../../components/common/UI';
import UserActionButton from './UserActionButton';
import UserSectionShell from './UserSectionShell';

export default function UserTable({
  users,
  roleDefinitions,
  roleToneMap,
  currentUsername,
  formatTime,
  onOpenEdit,
  onOpenReset,
  onToggleActive,
  onUnlock,
  onDeleteUser,
}) {
  return (
    <UserSectionShell title="账号列表" description="表头、按钮层级和操作密度统一收口，方便直接作为 v1 的正式后台页面。">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-6 py-3 font-semibold">账号</th>
              <th className="px-6 py-3 font-semibold">显示名 / 部门</th>
              <th className="px-6 py-3 font-semibold">系统角色</th>
              <th className="px-6 py-3 font-semibold">权限范围</th>
              <th className="px-6 py-3 font-semibold">密码策略</th>
              <th className="px-6 py-3 font-semibold">登录安全</th>
              <th className="px-6 py-3 font-semibold">上次登录</th>
              <th className="px-6 py-3 font-semibold">状态</th>
              <th className="px-6 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const roleLabel =
                roleDefinitions[user.role]?.label || (user.is_staff ? '超级管理员' : '普通用户');
              const isSelf = user.username === currentUsername;

              return (
                <tr key={user.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{user.username}</div>
                    <div className="text-[11px] text-slate-400">{user.phone || '未填写联系电话'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{user.display_name || user.username}</div>
                    <div className="text-[11px] text-slate-400">{user.department || '未归属部门'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        roleToneMap[user.role] || roleToneMap.guest
                      }`}
                    >
                      {roleLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {user.permission_scope || '按角色授权'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs leading-5 text-slate-500">
                    {user.must_change_password ? '下次登录强制修改密码' : '按策略正常使用'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>失败次数：{user.failed_login_attempts || 0}</div>
                      <div>
                        {user.locked_until ? `锁定至：${formatTime(user.locked_until)}` : '当前未锁定'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">{formatTime(user.last_login)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={user.is_active ? 'active' : 'offline'}
                      isLocked={!!user.locked_until}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <UserActionButton label="编辑用户" onClick={() => onOpenEdit(user)} />
                      <UserActionButton label="重置密码" onClick={() => onOpenReset(user)} />
                      <UserActionButton
                        label={user.is_active ? '禁用账号' : '启用账号'}
                        onClick={() => onToggleActive(user)}
                        disabled={isSelf}
                        tone="warning"
                        title={isSelf ? '不能停用当前登录账号' : ''}
                      />
                      <UserActionButton
                        label="解锁账号"
                        onClick={() => onUnlock(user.id)}
                        disabled={!user.locked_until}
                        tone="success"
                      />
                      <UserActionButton
                        label="删除用户"
                        onClick={() => onDeleteUser(user)}
                        disabled={isSelf}
                        tone="danger"
                        title={isSelf ? '不能删除当前登录账号' : ''}
                      />
                    </div>
                    {isSelf && (
                      <div className="mt-2 flex justify-end text-[11px] text-slate-400">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        当前登录账号受保护
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </UserSectionShell>
  );
}
