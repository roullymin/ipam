import React from 'react';
import { Archive, Clock3, Database, Download, FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react';

const LABELS = {
  title: 'Backup Operations',
  heading: 'Database Backup Center',
  intro:
    'Review backup health, trigger manual backups, and download historical files from one place. Use the restore reminders before any production recovery work.',
  refresh: 'Refresh',
  manualBackup: 'Run Backup',
  backupCount: 'Backup Files',
  latestBackup: 'Latest Backup',
  manualCount: 'Manual Backups',
  totalSize: 'Storage Used',
  fileTable: 'Backup Files',
  fileTableDesc: 'Download backup files directly and pair them with your restore checklist.',
  fileName: 'Filename',
  backupTime: 'Created At',
  size: 'Size',
  type: 'Type',
  actions: 'Actions',
  download: 'Download',
  empty: 'No backup files are available yet.',
  strategy: 'Backup Notes',
  storagePath: 'Storage Path',
  restoreTip: 'Restore Reminder',
  restoreChecks: 'Pre-Restore Checks',
  restoreCheck1: '1. Confirm the selected backup matches the required recovery point.',
  restoreCheck2: '2. Create a fresh backup of the current database before restoring.',
  restoreCheck3: '3. Validate the backup in a test environment whenever possible.',
  availableCount: 'Available backup file count',
  currentPath: 'Current storage location',
  noBackupYet: 'No backups yet',
  autoCountSuffix: 'automatic backups',
};

function ActionButton({ icon: Icon, label, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      className={
        primary
          ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-700'
          : 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50'
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
    <div className={`rounded-[22px] border px-5 py-4 shadow-sm ${tones[tone] || tones.default}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{title}</div>
      </div>
      <div className="mt-4 text-[22px] font-black leading-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{subtext}</div>
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
  if (backup?.type === 'Manual' || backup?.type === 'Automatic') return backup.type;
  if (backup?.type === '手动') return 'Manual';
  if (backup?.type === '自动') return 'Automatic';
  return String(backup?.filename || '').includes('manual') ? 'Manual' : 'Automatic';
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
    manual_count: backups.filter((item) => normalizeBackupType(item) === 'Manual').length,
    auto_count: backups.filter((item) => normalizeBackupType(item) === 'Automatic').length,
    total_size: '-',
    storage_path: '/app/backups',
    restore_tip: 'Stop the application and validate the backup before restoring it.',
  };

  const totalSizeLabel = formatBytes(resolvedSummary.total_bytes, resolvedSummary.total_size || '-');

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 animate-in slide-in-from-bottom duration-500 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-600">
                <Database className="h-4 w-4" />
                {LABELS.title}
              </div>
              <h2 className="mt-3 text-[30px] font-black tracking-tight text-slate-900">{LABELS.heading}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{LABELS.intro}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton icon={RefreshCw} label={LABELS.refresh} onClick={onRefresh} />
              <ActionButton icon={Archive} label={LABELS.manualBackup} onClick={onManualBackup} primary />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_0.95fr]">
          <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-black text-slate-900">{LABELS.fileTable}</h3>
              <p className="mt-1 text-sm text-slate-500">{LABELS.fileTableDesc}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-bold">{LABELS.fileName}</th>
                    <th className="px-6 py-4 font-bold">{LABELS.backupTime}</th>
                    <th className="px-6 py-4 font-bold">{LABELS.size}</th>
                    <th className="px-6 py-4 font-bold">{LABELS.type}</th>
                    <th className="px-6 py-4 font-bold text-right">{LABELS.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backups.map((backup) => (
                    <tr key={backup.filename} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm font-semibold text-slate-800">{backup.filename}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{backup.time}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {formatBytes(backup.bytes, backup.size || '-')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            normalizeBackupType(backup) === 'Manual'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {normalizeBackupType(backup)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onDownloadBackup(backup.filename)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
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
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                        {LABELS.empty}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-black text-slate-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                {LABELS.strategy}
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{LABELS.storagePath}</div>
                  <div className="mt-2 font-mono text-slate-800">{resolvedSummary.storage_path || '/app/backups'}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{LABELS.restoreTip}</div>
                  <div className="mt-2 leading-6 text-slate-600">
                    {resolvedSummary.restore_tip || 'Stop the application and validate the backup before restoring it.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <h3 className="text-lg font-black text-amber-900">{LABELS.restoreChecks}</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-900/80">
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
