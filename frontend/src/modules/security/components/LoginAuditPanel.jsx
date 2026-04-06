import React from 'react';
import { Activity } from 'lucide-react';

import SecurityEmptyState from './SecurityEmptyState';
import SecurityPanel from './SecurityPanel';

export default function LoginAuditPanel({ loginLogs, formatTime }) {
  return (
    <SecurityPanel
      icon={Activity}
      iconTone="text-cyan-600"
      title="登录审计"
      description="记录每次登录的时间、来源 IP 和结果状态，便于快速筛出失败或异常行为。"
    >
      {loginLogs.length === 0 ? (
        <SecurityEmptyState text="暂无登录审计记录。" />
      ) : (
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 font-semibold">时间</th>
              <th className="px-4 py-3 font-semibold">用户</th>
              <th className="px-4 py-3 font-semibold">来源 IP</th>
              <th className="px-4 py-3 font-semibold">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loginLogs.map((log) => {
              const success = String(log.status || '').toLowerCase() === 'success';
              return (
                <tr key={log.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-4 py-4 text-xs font-mono text-slate-500">{formatTime(log.timestamp)}</td>
                  <td className="px-4 py-4 font-semibold text-slate-800">{log.username || '未知用户'}</td>
                  <td className="px-4 py-4 text-xs font-mono text-slate-500">{log.ip_address || '-'}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        success
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {success ? '成功' : '失败'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SecurityPanel>
  );
}
