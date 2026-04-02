import React from 'react';
import { Activity, Plus, ShieldCheck, ScrollText } from 'lucide-react';

const formatTime = (value) => {
  if (!value) return '未记录';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return String(value);
  }
};

const actionLabels = {
  create: '创建',
  update: '更新',
  delete: '删除',
  unlock: '解锁',
  approve: '通过',
  reject: '驳回',
  import: '导入',
  export: '导出',
  download_template: '下载模板',
  change_password: '修改密码',
  trigger_backup: '执行备份',
  scan: '扫描',
};

const moduleLabels = {
  network_section: '网络分区',
  subnet: '子网',
  ip_address: 'IP 资产',
  user: '用户',
  blocklist: '黑名单',
  datacenter: '机房',
  rack: '机柜',
  rack_device: '设备',
  resident_staff: '驻场人员',
  system: '系统',
  backup: '备份',
  dcim: '机房设备',
};

const EmptyState = ({ text }) => (
  <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">{text}</div>
);

export default function SecurityCenterView({
  loginLogs = [],
  blocklist = [],
  auditLogs = [],
  onOpenBlockModal,
  onUnblock,
}) {
  return (
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-500">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 xl:grid-cols-3">
        <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div>
              <h3 className="flex items-center text-base font-bold text-slate-800">
                <Activity className="mr-2 h-4 w-4 text-blue-500" />
                登录审计
              </h3>
              <p className="mt-1 text-xs text-slate-500">记录每次登录的时间、来源 IP 和结果状态。</p>
            </div>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {loginLogs.length === 0 ? (
              <EmptyState text="暂无登录审计记录。" />
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold">时间</th>
                    <th className="px-6 py-3 font-semibold">用户</th>
                    <th className="px-6 py-3 font-semibold">来源 IP</th>
                    <th className="px-6 py-3 font-semibold">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginLogs.map((log) => {
                    const success = String(log.status || '').toLowerCase() === 'success';
                    return (
                      <tr key={log.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{formatTime(log.timestamp)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{log.username || '未知用户'}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.ip_address || '-'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              success
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
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
          </div>
        </section>

        <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div>
              <h3 className="flex items-center text-base font-bold text-slate-800">
                <ShieldCheck className="mr-2 h-4 w-4 text-red-500" />
                黑名单
              </h3>
              <p className="mt-1 text-xs text-slate-500">集中查看已封禁或可疑来源地址。</p>
            </div>
            <button
              onClick={onOpenBlockModal}
              className="inline-flex items-center rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700"
              type="button"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              封禁 IP
            </button>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {blocklist.length === 0 ? (
              <EmptyState text="暂无封禁地址。" />
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold">封禁 IP</th>
                    <th className="px-6 py-3 font-semibold">原因</th>
                    <th className="px-6 py-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blocklist.map((block) => (
                    <tr key={block.id} className="transition-colors hover:bg-red-50/30">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-red-600">{block.ip_address}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{block.reason || '未填写原因'}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onUnblock(block.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
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
          </div>
        </section>

        <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div>
              <h3 className="flex items-center text-base font-bold text-slate-800">
                <ScrollText className="mr-2 h-4 w-4 text-indigo-500" />
                审计轨迹
              </h3>
              <p className="mt-1 text-xs text-slate-500">跟踪敏感变更、审批结果以及批量导入导出操作。</p>
            </div>
          </div>
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
            {auditLogs.length === 0 ? (
              <EmptyState text="暂无审计记录。" />
            ) : (
              auditLogs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition-colors hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {(log.actor_name || '系统')}执行了
                        <span className="mx-1 text-blue-600">{actionLabels[log.action] || log.action}</span>
                        操作
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        模块：{moduleLabels[log.module] || log.module || '系统'} / 目标：
                        {log.target_display || log.target_type || '未指定'}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs font-mono text-slate-400">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                  {(log.detail || log.ip_address) && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      {log.detail ? <div>{log.detail}</div> : null}
                      {log.ip_address ? <div className="mt-1 font-mono">来源 IP：{log.ip_address}</div> : null}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
