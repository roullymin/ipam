import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FolderOpen,
  ListChecks,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { safeFetch } from '../../../lib/api';

const LABELS = {
  title: '备份操作',
  heading: '数据库备份中心',
  intro: '在一个页面中查看数据库备份健康情况、触发手动备份，并下载历史备份文件。',
  refresh: '刷新',
  manualBackup: '执行备份',
  backupCount: '备份文件',
  latestBackup: '最近备份',
  manualCount: '手动备份',
  totalSize: '已用存储',
  fileTable: '备份文件',
  fileTableDesc: '数据库备份文件与恢复检查信息。',
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

const COMMAND_PROFILE_LABELS = {
  huawei_vrp: '华为 / H3C VRP',
  h3c_comware: 'H3C Comware',
  cisco_ios: 'Cisco IOS',
  generic_show_run: '通用 show running-config',
};

const STATUS_LABELS = {
  success: '成功',
  failed: '失败',
  never: '未执行',
  disabled: '已停用',
};

const STATUS_STYLES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  never: 'bg-slate-100 text-slate-600 ring-slate-200',
  disabled: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function ActionButton({ icon: Icon, label, onClick, primary = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300'
          : 'inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400'
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
    amber: 'border-amber-200 bg-amber-50',
    rose: 'border-rose-200 bg-rose-50',
    violet: 'border-violet-200 bg-violet-50',
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

function Pill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ${STATUS_STYLES[status] || STATUS_STYLES.never}`}>
      {STATUS_LABELS[status] || status}
    </span>
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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getTargets(configBackups) {
  const rawTargets = configBackups?.targets || {};
  return Object.values(rawTargets).filter(Boolean);
}

function getTargetStatus(target) {
  if (!target?.enabled) return 'disabled';
  if (target?.last_status === 'success') return 'success';
  if (target?.last_status === 'failed') return 'failed';
  return 'never';
}

function getLatestBackupTime(target) {
  return target?.latest_version?.time_iso || target?.latest_version?.started_at || target?.last_backup_at || '';
}

function targetLocation(target) {
  return target?.location_label || target?.rack_device_name || target?.ip_asset_display || '-';
}

function classifyError(error) {
  const text = String(error || '').toLowerCase();
  if (!text) return '无失败';
  if (text.includes('认证') || text.includes('auth') || text.includes('password')) return '认证失败';
  if (text.includes('超时') || text.includes('timeout') || text.includes('timed out')) return '连接超时';
  if (text.includes('无法解析') || text.includes('name or service') || text.includes('resolve')) return '地址解析';
  if (text.includes('拒绝') || text.includes('refused')) return '拒绝连接';
  if (text.includes('不可达') || text.includes('unreachable') || text.includes('no route')) return '网络不可达';
  return '其他失败';
}

async function readApiError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  return payload?.detail || payload?.message || fallback;
}

function SegmentButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function NetworkBackupPanel({ configBackups, onRefresh }) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [errorFilter, setErrorFilter] = useState('all');
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [busyAction, setBusyAction] = useState('');

  const targets = useMemo(() => getTargets(configBackups), [configBackups]);
  const failedTargets = useMemo(() => targets.filter((target) => getTargetStatus(target) === 'failed'), [targets]);
  const typeOptions = useMemo(
    () => Array.from(new Set(targets.map((target) => target.device_type || '未分类'))),
    [targets],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(targets.map((target) => target.datacenter_name || '未登记机房'))),
    [targets],
  );
  const errorOptions = useMemo(
    () => Array.from(new Set(targets.map((target) => classifyError(target.last_error)).filter((item) => item !== '无失败'))),
    [targets],
  );
  const filteredTargets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return targets.filter((target) => {
      const status = getTargetStatus(target);
      const type = target.device_type || '未分类';
      const location = target.datacenter_name || '未登记机房';
      const errorType = classifyError(target.last_error);
      const haystack = [
        target.name,
        target.management_ip,
        target.device_type,
        target.credential_name,
        target.rack_device_name,
        target.location_label,
        target.datacenter_name,
        target.last_error,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (statusFilter === 'all' || status === statusFilter) &&
        (typeFilter === 'all' || type === typeFilter) &&
        (locationFilter === 'all' || location === locationFilter) &&
        (errorFilter === 'all' || errorType === errorFilter) &&
        (!normalizedKeyword || haystack.includes(normalizedKeyword))
      );
    });
  }, [errorFilter, keyword, locationFilter, statusFilter, targets, typeFilter]);

  const allFilteredSelected =
    filteredTargets.length > 0 && filteredTargets.every((target) => selectedTargetIds.includes(target.id));

  const refreshBackupData = async () => {
    if (typeof onRefresh === 'function') {
      await onRefresh('backup');
    }
  };

  const runTargets = async (targetIds = []) => {
    const actionKey = targetIds.length ? `run:${targetIds.join(',')}` : 'run:all';
    setBusyAction(actionKey);
    try {
      const response = await safeFetch('/api/config-backup-targets/run-all/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_ids: targetIds }),
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '执行配置备份失败。'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      window.alert(`执行完成：成功 ${payload.success || 0}，失败 ${payload.failed || 0}。`);
      setSelectedTargetIds([]);
      await refreshBackupData();
    } finally {
      setBusyAction('');
    }
  };

  const testTarget = async (target) => {
    setBusyAction(`test:${target.id}`);
    try {
      const response = await safeFetch(`/api/config-backup-targets/${target.id}/test/`, { method: 'POST' });
      if (!response.ok) {
        window.alert(await readApiError(response, '测试连接失败。'));
        await refreshBackupData();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      window.alert(payload.message || '测试连接成功。');
      await refreshBackupData();
    } finally {
      setBusyAction('');
    }
  };

  const toggleTarget = (targetId) => {
    setSelectedTargetIds((current) =>
      current.includes(targetId) ? current.filter((item) => item !== targetId) : [...current, targetId],
    );
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredTargets.map((target) => target.id));
      setSelectedTargetIds((current) => current.filter((item) => !filteredIds.has(item)));
      return;
    }
    setSelectedTargetIds((current) => Array.from(new Set([...current, ...filteredTargets.map((target) => target.id)])));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
              <Terminal className="h-4 w-4" />
              Network Config Backup
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900">网络配置备份中心</h2>
            <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-500">
              备份目标、最近版本、失败原因和执行入口集中在这里。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={RefreshCw} label="刷新" onClick={refreshBackupData} disabled={!!busyAction} />
            <ActionButton
              icon={ListChecks}
              label={`执行选中 ${selectedTargetIds.length}`}
              onClick={() => runTargets(selectedTargetIds)}
              disabled={busyAction || selectedTargetIds.length === 0}
            />
            <ActionButton icon={Play} label="执行全部" onClick={() => runTargets()} primary disabled={!!busyAction} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryTile icon={Server} title="备份目标" value={configBackups?.target_count || targets.length} subtext={`${configBackups?.enabled_target_count || 0} 个启用`} />
        <SummaryTile icon={CheckCircle2} title="成功目标" value={targets.filter((target) => getTargetStatus(target) === 'success').length} subtext="最近状态成功" tone="emerald" />
        <SummaryTile icon={AlertTriangle} title="失败目标" value={failedTargets.length} subtext="需要处理" tone={failedTargets.length ? 'rose' : 'default'} />
        <SummaryTile icon={Archive} title="配置版本" value={targets.reduce((sum, target) => sum + Number(target.version_count || 0), 0)} subtext="已保存版本" tone="violet" />
        <SummaryTile icon={Clock3} title="最近备份" value={formatDateTime(configBackups?.latest_backup_at)} subtext={configBackups?.latest_backup_name || '暂无文件'} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">备份目标</h3>
              <p className="mt-1 text-sm text-slate-500">显示 {filteredTargets.length} / {targets.length} 个目标</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex h-10 min-w-[260px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索设备、IP、凭据、错误"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="all">全部状态</option>
                <option value="success">成功</option>
                <option value="failed">失败</option>
                <option value="never">未执行</option>
                <option value="disabled">停用</option>
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="all">全部类型</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="all">全部机房</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
              <select
                value={errorFilter}
                onChange={(event) => setErrorFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="all">全部失败原因</option>
                {errorOptions.map((errorType) => (
                  <option key={errorType} value={errorType}>{errorType}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1080px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
                  </th>
                  <th className="px-4 py-3 font-bold">目标</th>
                  <th className="px-4 py-3 font-bold">类型</th>
                  <th className="px-4 py-3 font-bold">凭据</th>
                  <th className="px-4 py-3 font-bold">连接模板</th>
                  <th className="px-4 py-3 font-bold">最近版本</th>
                  <th className="px-4 py-3 font-bold">状态</th>
                  <th className="px-4 py-3 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTargets.map((target) => {
                  const status = getTargetStatus(target);
                  const selected = selectedTargetIds.includes(target.id);
                  const runBusy = busyAction === `run:${target.id}`;
                  const testBusy = busyAction === `test:${target.id}`;
                  return (
                    <tr key={target.id} className={selected ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'}>
                      <td className="px-4 py-3 align-top">
                        <input type="checkbox" checked={selected} onChange={() => toggleTarget(target.id)} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-slate-900">{target.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">{target.management_ip}</div>
                        <div className="mt-1 text-xs text-slate-500">{targetLocation(target)}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">{target.device_type || '未分类'}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-700">{target.credential_name || '未绑定'}</div>
                        <div className="mt-1 text-xs text-slate-500">{target.credential_username_hint || '-'}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-700">
                          {COMMAND_PROFILE_LABELS[target.command_profile] || target.command_profile || '默认模板'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          SSH {target.ssh_port || 22} / {target.timeout_seconds || 30}s / {target.save_before_backup ? '采集前保存' : '直接采集'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-slate-800">{target.version_count || 0} 个</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(getLatestBackupTime(target))}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Pill status={status} />
                        {target.last_error ? (
                          <div className="mt-2 max-w-[260px] truncate text-xs text-rose-600">{target.last_error}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => testTarget(target)}
                            disabled={!!busyAction}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                          >
                            {testBusy ? '测试中' : '测试'}
                          </button>
                          <button
                            type="button"
                            onClick={() => runTargets([target.id])}
                            disabled={!!busyAction}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                          >
                            {runBusy ? '执行中' : '执行'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredTargets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                      暂无配置备份目标。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-base font-black text-slate-900">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              失败设备
            </div>
            <div className="mt-3 space-y-2">
              {failedTargets.slice(0, 6).map((target) => (
                <div key={target.id} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                  <div className="font-bold text-rose-900">{target.name}</div>
                  <div className="mt-1 font-mono text-xs text-rose-700">{target.management_ip}</div>
                  <div className="mt-1 text-xs leading-5 text-rose-700">{target.last_error || '最近备份失败'}</div>
                </div>
              ))}
              {failedTargets.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">暂无失败目标。</div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-base font-black text-slate-900">
              <Settings2 className="h-5 w-5 text-blue-600" />
              最近版本
            </div>
            <div className="mt-3 space-y-2">
              {targets
                .filter((target) => getLatestBackupTime(target))
                .sort((a, b) => new Date(getLatestBackupTime(b)) - new Date(getLatestBackupTime(a)))
                .slice(0, 6)
                .map((target) => (
                  <div key={target.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="font-bold text-slate-900">{target.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(getLatestBackupTime(target))}</div>
                  </div>
                ))}
              {targets.filter((target) => getLatestBackupTime(target)).length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">暂无版本记录。</div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DatabaseBackupPanel({ backups, resolvedSummary, totalSizeLabel, onManualBackup, onDownloadBackup, onRefresh }) {
  return (
    <div className="space-y-4">
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
            <ActionButton icon={RefreshCw} label={LABELS.refresh} onClick={() => onRefresh?.('backup')} />
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
  );
}

export default function BackupView({
  backups = [],
  summary,
  configBackups,
  onManualBackup,
  onDownloadBackup,
  onRefresh,
}) {
  const [activePanel, setActivePanel] = useState('network');
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
        <div className="flex flex-wrap gap-2">
          <SegmentButton
            active={activePanel === 'network'}
            icon={Terminal}
            label="网络配置备份"
            onClick={() => setActivePanel('network')}
          />
          <SegmentButton
            active={activePanel === 'database'}
            icon={Database}
            label="数据库备份"
            onClick={() => setActivePanel('database')}
          />
        </div>

        {activePanel === 'network' ? (
          <NetworkBackupPanel configBackups={configBackups} onRefresh={onRefresh} />
        ) : (
          <DatabaseBackupPanel
            backups={backups}
            resolvedSummary={resolvedSummary}
            totalSizeLabel={totalSizeLabel}
            onManualBackup={onManualBackup}
            onDownloadBackup={onDownloadBackup}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
}
