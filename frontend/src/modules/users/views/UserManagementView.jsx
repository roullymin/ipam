import React from 'react';
import { Lock, Plus, ShieldCheck, UserRoundCog } from 'lucide-react';
import { StatusBadge } from '../../../components/common/UI';

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

function SummaryCard({ title, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className={`mt-3 text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

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
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-500">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">系统用户与权限控制</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              账号、角色、强制改密、登录锁定和启停状态统一由后端控制，前端负责展示、审核和运维操作。
            </p>
          </div>
          <button
            onClick={onCreateUser}
            className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            type="button"
          >
            <Plus className="mr-2 h-5 w-5" />
            创建用户
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <SummaryCard title="总账号数" value={users.length} />
          <SummaryCard title="启用账号" value={enabledUsers} tone="text-emerald-600" />
          <SummaryCard title="待改密账号" value={mustChangeUsers} tone="text-amber-600" />
          <SummaryCard title="已锁定账号" value={lockedUsers} tone="text-rose-600" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Object.entries(roleDefinitions).map(([role, meta]) => (
            <div key={role} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">{meta.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {permissionDescriptionMap[role]}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    roleToneMap[role] || roleToneMap.guest
                  }`}
                >
                  {(meta.permissions || []).length} 个模块
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(meta.permissions || []).map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-6 py-3 font-bold">账号</th>
                <th className="px-6 py-3 font-bold">显示名 / 部门</th>
                <th className="px-6 py-3 font-bold">系统角色</th>
                <th className="px-6 py-3 font-bold">权限范围</th>
                <th className="px-6 py-3 font-bold">密码策略</th>
                <th className="px-6 py-3 font-bold">登录安全</th>
                <th className="px-6 py-3 font-bold">上次登录</th>
                <th className="px-6 py-3 font-bold">状态</th>
                <th className="px-6 py-3 text-right font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => {
                const roleLabel =
                  roleDefinitions[user.role]?.label || (user.is_staff ? '超级管理员' : '普通用户');
                const isSelf = user.username === currentUsername;

                return (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/50">
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
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                          roleToneMap[user.role] || roleToneMap.guest
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {user.permission_scope || '按角色授权'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {user.must_change_password ? '下次登录强制修改密码' : '按策略正常使用'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs text-slate-500">
                        <div>失败次数：{user.failed_login_attempts || 0}</div>
                        <div>
                          {user.locked_until
                            ? `锁定至：${formatTime(user.locked_until)}`
                            : '当前未锁定'}
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
                      <div className="flex flex-wrap justify-end gap-3 text-xs font-bold">
                        <button
                          onClick={() => onOpenEdit(user)}
                          className="text-blue-600 hover:underline"
                          type="button"
                        >
                          编辑用户
                        </button>
                        <button
                          onClick={() => onOpenReset(user)}
                          className="text-blue-600 hover:underline"
                          type="button"
                        >
                          重置密码
                        </button>
                        <button
                          onClick={() => onToggleActive(user)}
                          className={`${
                            isSelf
                              ? 'cursor-not-allowed text-slate-300'
                              : 'text-amber-600 hover:underline'
                          }`}
                          disabled={isSelf}
                          type="button"
                          title={isSelf ? '不能停用当前登录账号' : ''}
                        >
                          {user.is_active ? '禁用账号' : '启用账号'}
                        </button>
                        <button
                          onClick={() => onUnlock(user.id)}
                          className={`${
                            user.locked_until
                              ? 'text-emerald-600 hover:underline'
                              : 'cursor-not-allowed text-slate-300'
                          }`}
                          disabled={!user.locked_until}
                          type="button"
                        >
                          解锁账号
                        </button>
                        <button
                          onClick={() => onDeleteUser(user)}
                          className={`${
                            isSelf
                              ? 'cursor-not-allowed text-slate-300'
                              : 'text-red-500 hover:underline'
                          }`}
                          disabled={isSelf}
                          type="button"
                          title={isSelf ? '不能删除当前登录账号' : ''}
                        >
                          删除用户
                        </button>
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

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <UserRoundCog className="h-4 w-4 text-blue-600" />
            权限说明
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="mb-2 font-semibold text-slate-800">账号启停</div>
              禁用后用户会立即失去登录能力，但历史数据和审计记录仍然保留。
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="mb-2 flex items-center font-semibold text-slate-800">
                <Lock className="mr-1.5 h-4 w-4 text-amber-500" />
                登录锁定
              </div>
              连续失败达到阈值后账号会被锁定，管理员可在此页手动解锁。
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="mb-2 font-semibold text-slate-800">强制改密</div>
              新建账号、重置密码和敏感角色切换后，都建议启用“下次登录必须修改密码”。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
