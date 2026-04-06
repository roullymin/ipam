import React from 'react';
import { Activity, Plus, ShieldCheck, ShieldX } from 'lucide-react';

import ListToolbar from '../../../components/common/ListToolbar';
import SecuritySummaryCard from './SecuritySummaryCard';

export default function SecurityOverview({
  loginLogs,
  blocklist,
  auditLogs,
  failedLogins,
  onOpenBlockModal,
}) {
  return (
    <ListToolbar
      eyebrow="Security Center"
      title="安全中心与审计轨迹"
      description="统一查看登录异常、封禁来源和高风险操作，保持安全模块与首页、列表页同一套壳层节奏。"
      resultSummary={`登录记录 ${loginLogs.length} 条 / 封禁地址 ${blocklist.length} 条 / 审计 ${auditLogs.length} 条`}
      actions={
        <button
          onClick={onOpenBlockModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition-all hover:-translate-y-0.5 hover:bg-rose-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          封禁 IP
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <SecuritySummaryCard icon={Activity} label="登录事件" value={loginLogs.length} />
        <SecuritySummaryCard icon={ShieldX} label="异常登录" value={failedLogins} tone="danger" />
        <SecuritySummaryCard icon={ShieldCheck} label="黑名单地址" value={blocklist.length} tone="warning" />
      </div>
    </ListToolbar>
  );
}
