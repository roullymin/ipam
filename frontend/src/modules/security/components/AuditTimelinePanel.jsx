import React from 'react';
import { ScrollText } from 'lucide-react';

import SecurityEmptyState from './SecurityEmptyState';
import SecurityPanel from './SecurityPanel';

export default function AuditTimelinePanel({
  auditLogs,
  formatTime,
  actionLabels,
  moduleLabels,
}) {
  return (
    <SecurityPanel
      icon={ScrollText}
      iconTone="text-indigo-600"
      title="审计轨迹"
      description="跟踪敏感变更、审批结果以及批量导入导出操作，保持结构与其他卡片一致。"
    >
      {auditLogs.length === 0 ? (
        <SecurityEmptyState text="暂无审计记录。" />
      ) : (
        <div className="space-y-3">
          {auditLogs.map((log) => (
            <article
              key={log.id}
              className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {(log.actor_name || '系统')}执行了
                    <span className="mx-1 text-cyan-700">{actionLabels[log.action] || log.action}</span>
                    操作
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    模块：{moduleLabels[log.module] || log.module || '系统'} / 目标：
                    {log.target_display || log.target_type || '未指定'}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs font-mono text-slate-400">
                  {formatTime(log.created_at)}
                </span>
              </div>
              {(log.detail || log.ip_address) && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-500">
                  {log.detail ? <div>{log.detail}</div> : null}
                  {log.ip_address ? <div className="mt-1 font-mono">来源 IP：{log.ip_address}</div> : null}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </SecurityPanel>
  );
}
