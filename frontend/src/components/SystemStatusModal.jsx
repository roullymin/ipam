import React from 'react';
import { Activity, Database, GitBranch, HardDrive, RefreshCw, ShieldAlert, TimerReset } from 'lucide-react';

import { Modal } from './common/UI';
import { BUILD_INFO, shortCommitLabel } from '../lib/buildInfo';

const formatDateTime = (value) => {
  if (!value) return '未提供';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
};

const StatCard = ({ icon: Icon, label, value, hint, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50',
    cyan: 'border-cyan-200 bg-cyan-50',
    amber: 'border-amber-200 bg-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 text-2xl font-black text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div> : null}
    </div>
  );
};

export default function SystemStatusModal({
  isOpen,
  onClose,
  overview,
  backendVersion,
  isLoading,
  onRefresh,
  lastRefreshedAt,
}) {
  const backend = overview?.backend || backendVersion || null;
  const counts = overview?.counts || {};
  const backup = overview?.backup || {};
  const dataQuality = overview?.data_quality || {};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="版本与部署检查" size="xl">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">当前运行版本</div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              前端 {BUILD_INFO.version} · 后端 {backend?.version || '未获取'}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              前端构建 {formatDateTime(BUILD_INFO.builtAt)} · 后端提交 {shortCommitLabel(backend?.commit)}
            </div>
          </div>
          <button
            onClick={onRefresh}
            type="button"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-cyan-200 hover:text-cyan-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新状态
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Database}
            label="备份状态"
            value={backup?.backup_count ?? 0}
            hint={backup?.latest_backup_time ? `最近备份：${backup.latest_backup_time}` : '还没有备份文件'}
            tone={backup?.backup_count ? 'emerald' : 'amber'}
          />
          <StatCard
            icon={ShieldAlert}
            label="数据质量"
            value={dataQuality?.suspected_records ?? 0}
            hint={`疑似乱码字段 ${dataQuality?.suspected_fields ?? 0} 个`}
            tone={(dataQuality?.suspected_records || 0) > 0 ? 'amber' : 'emerald'}
          />
          <StatCard
            icon={HardDrive}
            label="基础资产"
            value={`${counts?.datacenters ?? 0} / ${counts?.racks ?? 0}`}
            hint={`机房 ${counts?.datacenters ?? 0} 个，机柜 ${counts?.racks ?? 0} 个`}
            tone="cyan"
          />
          <StatCard
            icon={Activity}
            label="纳管对象"
            value={`${counts?.devices ?? 0} 台`}
            hint={`IP ${counts?.ips ?? 0} 条，驻场 ${counts?.resident_staff ?? 0} 人`}
            tone="slate"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <GitBranch className="h-4 w-4 text-cyan-600" />
              前后端版本明细
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div>
                <div className="font-semibold text-slate-800">前端</div>
                <div>版本：{BUILD_INFO.version}</div>
                <div>分支：{BUILD_INFO.branch || '未知'}</div>
                <div>提交：{shortCommitLabel(BUILD_INFO.commit)}</div>
                <div>构建时间：{formatDateTime(BUILD_INFO.builtAt)}</div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="font-semibold text-slate-800">后端</div>
                <div>版本：{backend?.version || '未获取'}</div>
                <div>分支：{backend?.branch || '未知'}</div>
                <div>提交：{shortCommitLabel(backend?.commit)}</div>
                <div>提交时间：{formatDateTime(backend?.committed_at)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <TimerReset className="h-4 w-4 text-cyan-600" />
              部署后检查建议
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div>1. 先核对前后端提交号是否一致，再刷新页面缓存。</div>
              <div>2. 关注最近备份时间，更新前后都保留一份可回滚备份。</div>
              <div>3. 数据质量若仍有疑似乱码，先跑预览快照，再执行修复命令。</div>
              <div>4. 导入新表时先走预览，确认编码、字段和冲突策略后再真正入库。</div>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              上次刷新：{lastRefreshedAt ? formatDateTime(lastRefreshedAt) : '尚未刷新'}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Activity className="h-4 w-4 text-cyan-600" />
            固定验收步骤
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-600">
              <div className="font-bold text-slate-800">服务器侧</div>
              <div className="mt-2 font-mono text-[11px] leading-6 text-slate-500">
                git log -1 --oneline
                <br />
                git sparse-checkout list
                <br />
                cat frontend/dist/index.html
                <br />
                docker compose ps
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-600">
              <div className="font-bold text-slate-800">浏览器侧</div>
              <div className="mt-2">
                1. 强制刷新页面。
                <br />
                2. 核对页面加载的 JS hash 与 `frontend/dist/index.html` 一致。
                <br />
                3. 先看系统状态弹层，再判断是不是服务器没更新。
                <br />
                4. 若目录异常，优先排查 sparse-checkout。
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
