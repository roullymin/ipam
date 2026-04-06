import React from 'react';
import { Plus } from 'lucide-react';

import ListToolbar from '../../../components/common/ListToolbar';
import UserSummaryCard from './UserSummaryCard';

export default function UserOverview({
  users,
  enabledUsers,
  mustChangeUsers,
  lockedUsers,
  onCreateUser,
}) {
  return (
    <ListToolbar
      eyebrow="Identity & Access"
      title="系统用户与权限控制"
      description="统一收口账号、角色、强制改密、登录锁定和启停状态的视觉节奏，保持与首页和列表页一致。"
      resultSummary={`账号总数 ${users.length} 个`}
      actions={
        <button
          onClick={onCreateUser}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          创建用户
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <UserSummaryCard title="总账号数" value={users.length} />
        <UserSummaryCard title="启用账号" value={enabledUsers} tone="text-emerald-600" />
        <UserSummaryCard title="待改密账号" value={mustChangeUsers} tone="text-amber-600" />
        <UserSummaryCard title="已锁定账号" value={lockedUsers} tone="text-rose-600" />
      </div>
    </ListToolbar>
  );
}
