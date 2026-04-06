import React from 'react';

import { BUILD_INFO, shortCommitLabel } from '../../../lib/buildInfo';
import DashboardPanel from './DashboardPanel';

function VersionCard({ label, value, helper }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-black tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{helper}</div>
    </div>
  );
}

export default function DashboardVersionStatusPanel({
  overview,
  lastRefreshedAt,
  formatDateTime,
  onOpenSystemStatus,
}) {
  return (
    <DashboardPanel title="版本与部署状态" subtitle="避免每次都进弹层或 SSH 排查。">
      <div className="grid gap-4 md:grid-cols-2">
        <VersionCard
          label="前端版本"
          value={`${BUILD_INFO.version} · ${shortCommitLabel(BUILD_INFO.commit)}`}
          helper={`构建时间：${formatDateTime(BUILD_INFO.builtAt)}`}
        />
        <VersionCard
          label="后端版本"
          value={`${overview?.backend?.version || '未获取'} · ${shortCommitLabel(overview?.backend?.commit)}`}
          helper={`最后提交：${formatDateTime(overview?.backend?.committed_at)}`}
        />
        <VersionCard
          label="备份状态"
          value={overview?.backup?.latest_filename ? `${overview?.backup?.file_count || 0} 份备份` : '暂无备份摘要'}
          helper={overview?.backup?.latest_filename || '建议确认自动备份与下载链路正常'}
        />
        <VersionCard
          label="数据质量"
          value={`${overview?.data_quality?.suspected_records || 0} 条疑似乱码`}
          helper="建议先扫描、快照，再应用修复。"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        <div className="flex flex-wrap gap-3">
          <span>页面刷新：{formatDateTime(lastRefreshedAt)}</span>
          <span>前端分支：{BUILD_INFO.branch || '未知'}</span>
          <span>后端分支：{overview?.backend?.branch || '未知'}</span>
        </div>
        <button
          onClick={onOpenSystemStatus}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          type="button"
        >
          打开系统状态
        </button>
      </div>
    </DashboardPanel>
  );
}
