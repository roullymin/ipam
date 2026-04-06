import React from 'react';
import { ShieldCheck } from 'lucide-react';

import SecurityEmptyState from './SecurityEmptyState';
import SecurityPanel from './SecurityPanel';

export default function BlocklistPanel({ blocklist, onUnblock }) {
  return (
    <SecurityPanel
      icon={ShieldCheck}
      iconTone="text-rose-600"
      title="黑名单"
      description="集中查看已封禁或可疑来源地址，危险操作统一用红色主按钮承载。"
    >
      {blocklist.length === 0 ? (
        <SecurityEmptyState text="暂无封禁地址。" />
      ) : (
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 font-semibold">封禁 IP</th>
              <th className="px-4 py-3 font-semibold">原因</th>
              <th className="px-4 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {blocklist.map((block) => (
              <tr key={block.id} className="transition-colors hover:bg-rose-50/30">
                <td className="px-4 py-4 text-xs font-semibold text-rose-600">
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 font-mono">{block.ip_address}</span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500">{block.reason || '未填写原因'}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() => onUnblock(block.id)}
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                    type="button"
                  >
                    解除封禁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SecurityPanel>
  );
}
