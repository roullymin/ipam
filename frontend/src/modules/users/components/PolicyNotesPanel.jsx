import React from 'react';
import { Lock, UserRoundCog } from 'lucide-react';

import UserSectionShell from './UserSectionShell';

export default function PolicyNotesPanel() {
  return (
    <UserSectionShell title="权限说明" description="补足发版前的人机说明，让管理员能快速理解账号启停、锁定和强制改密策略。">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          <div className="mb-2 font-bold text-slate-800">账号启停</div>
          禁用后用户会立即失去登录能力，但历史数据和审计记录仍然保留。
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          <div className="mb-2 flex items-center font-bold text-slate-800">
            <Lock className="mr-1.5 h-4 w-4 text-amber-500" />
            登录锁定
          </div>
          连续失败达到阈值后账号会被锁定，管理员可在此页手动解锁。
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          <div className="mb-2 flex items-center font-bold text-slate-800">
            <UserRoundCog className="mr-1.5 h-4 w-4 text-cyan-600" />
            强制改密
          </div>
          新建账号、重置密码和敏感角色切换后，都建议启用“下次登录必须修改密码”。
        </div>
      </div>
    </UserSectionShell>
  );
}
