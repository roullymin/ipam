import React from 'react';
import { Archive, Clock3, Database, Download, FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react';

const LABELS = {
  title: '备份操作',
  heading: '数据库备份中心',
  intro:
    '在一个页面中查看备份健康情况、触发手动备份，并下载历史备份文件。执行生产恢复前，请先阅读恢复提示。',
  refresh: '刷新',
  manualBackup: '执行备份',
  backupCount: '备份文件',
  latestBackup: '最近备份',
  manualCount: '手动备份',
  totalSize: '已用存储',
  fileTable: '备份文件',
  fileTableDesc: '直接下载备份文件，并结合你的恢复检查清单一起使用。',
  fileName: '文件名',
  backupTime: '创建时间',
  size: '大小',
  type: '类型',
  actions: '操作',
  download: '下载',
  empty: '暂无备份文件。',
  strategy: '备份说明',
  storagePath: '存储路径',
  restoreTip: '恢复提示',
  restoreChecks: '恢复前检查',
  restoreCheck1: '1. 确认所选备份与目标恢复时间点一致。',
  restoreCheck2: '2. 在恢复前先对当前数据库再做一次最新备份。',
  restoreCheck3: '3. 条件允许时，优先在测试环境验证备份可用性。',
  availableCount: '当前可用备份文件数',
  currentPath: '当前存储位置',
  noBackupYet: '暂无备份',
  autoCountSuffix: '个自动备份',
  typeManual: '手动',
  typeAutomatic: '自动',
};

function ActionButton({ icon: Icon, label, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      className={
        primary
          ? 'inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition-colors hover:bg-blue-700'
          : 'inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50'
      }
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SummaryTile({ icon: Icon, title, value, subtext, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200 bg-emerald-50',
    blue: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || tones.default}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div className="text-xs font-bold text-slate-500">{title}</div>
      </div>
      <div className="mt-3 truncate text-2xl font-black leading-tight text-slate-900">{value}</div>
      <div className="mt-1 truncate text-sm text-slate-500">{subtext}</div>
    </div>
  );
}

function formatBytes(bytes, fallback = '-') {
  const parsed = Number(bytes);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (parsed < 1024) return `${parsed.toFixed(0)} B`;
  if (parsed < 1024 * 1024) return `${(parsed / 1024).toFixed(parsed < 10 * 1024 ? 1 : 0)} KB`;
  if (parsed < 1024 * 1024 * 1024) return `${(parsed / 1024 / 1024).toFixed(parsed < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  return `${(parsed / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function normalizeBackupType(backup) {
  if (backup?.type === 'Manual' || backup?.type === '手动') return LABELS.typeManual;
  if (backup?.type === 'Automatic' || backup?.type === '自动') return LABELS.typeAutomatic;
  return String(backup?.filename || '').includes('manual') ? LABELS.typeManual : LABELS.typeAutomatic;
}

export default function BackupView({
  backups = [],
  summary,
  onManualBackup,
  onDownloadBackup,
  onRefresh,
}) {
  const resolvedSummary = summary || {
    latest_backup_time: '',
    latest_backup_name: '',
    backup_count: backups.length,
    manual_count: backups.filter((item) => normalizeBackupType(item) === LABELS.typeManual).length,
    auto_count: backups.filter((item) => normalizeBackupType(item) === LABELS.typeAutomatic).length,
    total_size: '-',
    storage_path: '/app/backups',
    restore_tip: '恢复前请先停止业务容器，并先校验备份文件是否完整。',
  };

  const totalSizeLabel = formatBytes(resolvedSummary.total_bytes, resolvedSummary.total_size || '-');

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-slate-100 p-4 animate-in slide-in-from-bottom duration-500 lg:p-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-sky-600">
                <Database className="h-4 w-4" />
                {LABELS.title}
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">{LABELS.heading}</h2>
              <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-500">{LABELS.intro}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton icon={RefreshCw} label={LABELS.refresh} onClick={onRefresh} />
              <ActionButton icon={Archive} label={LABELS.manualBackup} onClick={onManualBackup} primary />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryTile
            icon={Archive}
            title={LABELS.backupCount}
            value={resolvedSummary.backup_count || 0}
            subtext={LABELS.availableCount}
          />
          <SummaryTile
            icon={Clock3}
            title={LABELS.latestBackup}
            value={resolvedSummary.latest_backup_time || '-'}
            subtext={resolvedSummary.latest_backup_name || LABELS.noBackupYet}
            tone="blue"
          />
          <SummaryTile
            icon={Database}
            title={LABELS.manualCount}
            value={resolvedSummary.manual_count || 0}
            subtext={`${resolvedSummary.auto_count || 0} ${LABELS.autoCountSuffix}`}
          />
          <SummaryTile
            icon={FolderOpen}
            title={LABELS.totalSize}
            value={totalSizeLabel}
            subtext={LABELS.currentPath}
            tone="emerald"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_0.95fr]">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-black text-slate-900">{LABELS.fileTable}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-500">{LABELS.fileTableDesc}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">{LABELS.fileName}</th>
                    <th className="px-4 py-3 font-bold">{LABELS.backupTime}</th>
                    <th className="px-4 py-3 font-bold">{LABELS.size}</th>
                    <th className="px-4 py-3 font-bold">{LABELS.type}</th>
                    <th className="px-4 py-3 font-bold text-right">{LABELS.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backups.map((backup) => (
                    <tr key={backup.filename} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-semibold text-slate-800">{backup.filename}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{backup.time}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatBytes(backup.bytes, backup.size || '-')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            normalizeBackupType(backup) === LABELS.typeManual
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {normalizeBackupType(backup)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onDownloadBackup(backup.filename)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                          {LABELS.download}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                        {LABELS.empty}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-base font-black text-slate-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                {LABELS.strategy}
              </div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="text-xs font-bold text-slate-500">{LABELS.storagePath}</div>
                  <div className="mt-2 font-mono text-slate-800">{resolvedSummary.storage_path || '/app/backups'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="text-xs font-bold text-slate-500">{LABELS.restoreTip}</div>
                  <div className="mt-2 leading-5 text-slate-600">
                    {resolvedSummary.restore_tip || '恢复前请先停止业务容器，并先校验备份文件是否完整。'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-base font-black text-amber-900">{LABELS.restoreChecks}</h3>
              <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-900/80">
                <li>{LABELS.restoreCheck1}</li>
                <li>{LABELS.restoreCheck2}</li>
                <li>{LABELS.restoreCheck3}</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
