import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Eye,
  FolderOpen,
  HardDrive,
  ListChecks,
  Mail,
  Play,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
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

const WEEKDAY_OPTIONS = [
  { value: 0, label: '周一' },
  { value: 1, label: '周二' },
  { value: 2, label: '周三' },
  { value: 3, label: '周四' },
  { value: 4, label: '周五' },
  { value: 5, label: '周六' },
  { value: 6, label: '周日' },
];

const DEVICE_TYPE_LABELS = {
  switch_core: '核心交换机',
  switch_access: '接入交换机',
  switch: '交换机',
  router: '路由器',
  firewall: '防火墙',
  load_balancer: '负载均衡',
  waf: 'WAF',
  ids: 'IDS/IPS',
  wireless_controller: '无线控制器',
  ap: '无线 AP',
  server: '服务器',
  storage: '存储设备',
  security: '安全设备',
  video_conference: '会议/视频设备',
  gateway: '网关',
  other: '其他',
};

function createPolicyForm(policy = {}) {
  return {
    enabled: !!policy.enabled,
    schedule_frequency: policy.schedule_frequency || 'weekly',
    schedule_time: String(policy.schedule_time || '03:00').slice(0, 5),
    schedule_weekday: Number(policy.schedule_weekday ?? 6),
    execution_strategy: policy.execution_strategy || 'all',
    strategy_device_type: policy.strategy_device_type || '',
    strategy_datacenter: policy.strategy_datacenter || '',
    retention_count: policy.retention_count || 1,
    email_enabled: !!policy.email_enabled,
    email_recipients: policy.email_recipients || '',
    notify_on_success: !!policy.notify_on_success,
    notify_on_failure: policy.notify_on_failure ?? true,
    email_subject_prefix: policy.email_subject_prefix || '[IPAM 配置备份]',
    apply_retention_to_targets: false,
  };
}

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

function joinBackupPath(base, relative) {
  if (!base || !relative) return relative || base || '-';
  return `${String(base).replace(/[\\/]+$/, '')}/${String(relative).replace(/^[\\/]+/, '')}`;
}

function unwrapListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function getVersionMoment(version) {
  return version?.time_iso || version?.finished_at || version?.started_at || version?.created_at || '';
}

function sortVersionsByTime(versions) {
  return [...versions].sort((a, b) => {
    const timeA = new Date(getVersionMoment(a)).getTime() || 0;
    const timeB = new Date(getVersionMoment(b)).getTime() || 0;
    return timeB - timeA || Number(b?.id || 0) - Number(a?.id || 0);
  });
}

function hasConfigBackupRows(summary) {
  return getTargets(summary).length > 0 || (Array.isArray(summary?.versions) && summary.versions.length > 0);
}

function buildFallbackConfigBackups({ existing, targets, versions }) {
  const useExistingRows = hasConfigBackupRows(existing);
  const sortedVersions = sortVersionsByTime(versions);
  const versionsByTarget = new Map();
  sortedVersions.forEach((version) => {
    const targetKey = String(version?.target || '');
    if (!targetKey) return;
    const bucket = versionsByTarget.get(targetKey) || [];
    bucket.push(version);
    versionsByTarget.set(targetKey, bucket);
  });

  const targetMap = {};
  const deviceMap = {};
  const failureCounts = {};
  targets.forEach((target) => {
    const ipKey = String(target?.management_ip || target?.ip || target?.id || '').trim();
    if (!ipKey) return;
    const targetVersions = versionsByTarget.get(String(target.id)) || [];
    const latestVersion = target.latest_version || targetVersions[0] || null;
    const normalizedTarget = {
      ...target,
      latest_version: latestVersion,
      version_count: Number(target.version_count ?? targetVersions.length),
      last_backup_at: target.last_backup_at || getVersionMoment(latestVersion),
    };
    targetMap[ipKey] = normalizedTarget;
    deviceMap[ipKey] = {
      ip: ipKey,
      device_type: target.device_type || '',
      version_count: normalizedTarget.version_count,
      latest: latestVersion,
      versions: targetVersions,
      target: normalizedTarget,
    };

    if (getTargetStatus(target) === 'failed') {
      const reason = classifyError(target.last_error);
      failureCounts[reason] = (failureCounts[reason] || 0) + 1;
    }
  });

  const latestVersion = sortedVersions[0] || null;
  const totalBytes = sortedVersions.reduce((sum, version) => sum + Number(version?.bytes || 0), 0);
  return {
    ...(existing || {}),
    targets: useExistingRows && Object.keys(existing?.targets || {}).length ? existing.targets : targetMap,
    devices: useExistingRows && Object.keys(existing?.devices || {}).length ? existing.devices : deviceMap,
    versions: useExistingRows && Array.isArray(existing?.versions) && existing.versions.length ? existing.versions : sortedVersions,
    target_count: useExistingRows ? existing?.target_count ?? Object.keys(targetMap).length : Object.keys(targetMap).length,
    enabled_target_count: useExistingRows ? existing?.enabled_target_count ?? targets.filter((target) => target.enabled).length : targets.filter((target) => target.enabled).length,
    total_devices: useExistingRows ? existing?.total_devices ?? Object.keys(deviceMap).length : Object.keys(deviceMap).length,
    total_files: useExistingRows ? existing?.total_files ?? sortedVersions.length : sortedVersions.length,
    total_bytes: useExistingRows ? existing?.total_bytes ?? totalBytes : totalBytes,
    total_size: useExistingRows && existing?.total_size ? existing.total_size : formatBytes(totalBytes, '0 B'),
    latest_backup_at: useExistingRows && existing?.latest_backup_at ? existing.latest_backup_at : getVersionMoment(latestVersion),
    latest_backup_name: useExistingRows && existing?.latest_backup_name ? existing.latest_backup_name : latestVersion?.filename || '',
    container_storage_path: existing?.container_storage_path || existing?.storage_path || '/backup',
    host_storage_path: existing?.host_storage_path || './data/config_backups',
    storage_path: existing?.storage_path || '/backup',
    failure_summary: Array.isArray(existing?.failure_summary) && existing.failure_summary.length
      ? existing.failure_summary
      : Object.entries(failureCounts).map(([reason, count]) => ({ reason, count })),
  };
}

function VersionContentModal({ viewer, onClose }) {
  if (!viewer) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-base font-black text-slate-900">{viewer.filename || '配置版本'}</h3>
            <div className="mt-1 font-mono text-xs text-slate-500">{viewer.container_full_path || viewer.relative_path}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {viewer.truncated ? (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">
            文件较大，当前只展示前 1 MB 内容。
          </div>
        ) : null}
        <pre className="custom-scrollbar overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {viewer.content || '暂无内容'}
        </pre>
      </div>
    </div>
  );
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
  const [policyForm, setPolicyForm] = useState(() => createPolicyForm(configBackups?.policy));
  const [viewer, setViewer] = useState(null);
  const [fallbackConfigBackups, setFallbackConfigBackups] = useState(null);
  const [fallbackError, setFallbackError] = useState('');

  const effectiveConfigBackups = fallbackConfigBackups || configBackups;
  const isFallbackSummary = Boolean(fallbackConfigBackups);
  const targets = useMemo(() => getTargets(effectiveConfigBackups), [effectiveConfigBackups]);
  const versions = useMemo(
    () => (Array.isArray(effectiveConfigBackups?.versions) ? effectiveConfigBackups.versions : []),
    [effectiveConfigBackups],
  );
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
  const hostStoragePath = effectiveConfigBackups?.host_storage_path || './data/config_backups';
  const containerStoragePath = effectiveConfigBackups?.container_storage_path || effectiveConfigBackups?.storage_path || '/backup';
  const latestPolicy = effectiveConfigBackups?.policy || {};

  useEffect(() => {
    setPolicyForm(createPolicyForm(effectiveConfigBackups?.policy));
  }, [effectiveConfigBackups?.policy]);

  useEffect(() => {
    let cancelled = false;

    if (hasConfigBackupRows(configBackups)) {
      setFallbackConfigBackups(null);
      setFallbackError('');
      return () => {
        cancelled = true;
      };
    }

    const loadFallbackSummary = async () => {
      try {
        const [targetsResponse, versionsResponse] = await Promise.all([
          safeFetch('/api/config-backup-targets/'),
          safeFetch('/api/config-backup-versions/'),
        ]);
        if (!targetsResponse.ok) {
          throw new Error(await readApiError(targetsResponse, '读取配置备份目标失败。'));
        }
        if (!versionsResponse.ok) {
          throw new Error(await readApiError(versionsResponse, '读取配置版本失败。'));
        }
        const [targetPayload, versionPayload] = await Promise.all([
          targetsResponse.json().catch(() => []),
          versionsResponse.json().catch(() => []),
        ]);
        if (cancelled) return;
        const fallbackSummary = buildFallbackConfigBackups({
          existing: configBackups,
          targets: unwrapListPayload(targetPayload),
          versions: unwrapListPayload(versionPayload),
        });
        setFallbackConfigBackups(fallbackSummary);
        setFallbackError('');
      } catch (error) {
        if (cancelled) return;
        setFallbackConfigBackups(null);
        setFallbackError(error?.message || '读取配置备份明细失败。');
      }
    };

    loadFallbackSummary();
    return () => {
      cancelled = true;
    };
  }, [configBackups]);

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

  const runStrategy = async (strategy = policyForm.execution_strategy) => {
    setBusyAction(`strategy:${strategy}`);
    try {
      const response = await safeFetch('/api/config-backup-targets/run-all/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          device_type: policyForm.strategy_device_type,
          datacenter: policyForm.strategy_datacenter,
          notify: policyForm.email_enabled,
        }),
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '按策略执行失败。'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const emailDetail = payload.email?.detail ? `\n邮件：${payload.email.detail}` : '';
      window.alert(`执行完成：成功 ${payload.success || 0}，失败 ${payload.failed || 0}。${emailDetail}`);
      await refreshBackupData();
    } finally {
      setBusyAction('');
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    setBusyAction('policy:save');
    try {
      const response = await safeFetch('/api/config-backups/policy/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm),
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '保存备份策略失败。'));
        return;
      }
      await refreshBackupData();
    } finally {
      setBusyAction('');
    }
  };

  const testEmail = async () => {
    setBusyAction('policy:test-email');
    try {
      const response = await safeFetch('/api/config-backups/test-email/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm),
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '测试邮件发送失败。'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      window.alert(payload.detail || '测试邮件已发送。');
      await refreshBackupData();
    } finally {
      setBusyAction('');
    }
  };

  const viewVersion = async (version) => {
    setBusyAction(`view:${version.id}`);
    try {
      const response = await safeFetch(`/api/config-backup-versions/${version.id}/content/`);
      if (!response.ok) {
        window.alert(await readApiError(response, '读取配置内容失败。'));
        return;
      }
      setViewer(await response.json());
    } finally {
      setBusyAction('');
    }
  };

  const downloadVersion = (version) => {
    window.open(`/api/config-backup-versions/${version.id}/download/`, '_blank', 'noopener,noreferrer');
  };

  const deleteVersion = async (version) => {
    if (!version?.id) return;
    const filename = version.filename || version.name || `版本 ${version.id}`;
    if (!window.confirm(`确定删除配置版本「${filename}」吗？文件和版本记录都会删除。`)) return;
    setBusyAction(`delete:${version.id}`);
    try {
      const response = await safeFetch(`/api/config-backup-versions/${version.id}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '删除配置版本失败。'));
        return;
      }
      setFallbackConfigBackups(null);
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
            <ActionButton
              icon={Settings2}
              label="按策略执行"
              onClick={() => runStrategy()}
              disabled={!!busyAction}
            />
            <ActionButton
              icon={AlertTriangle}
              label="重试失败"
              onClick={() => runStrategy('failed')}
              disabled={!!busyAction || failedTargets.length === 0}
            />
            <ActionButton icon={Play} label="执行全部" onClick={() => runTargets()} primary disabled={!!busyAction} />
          </div>
        </div>
      </section>

      {isFallbackSummary && (targets.length > 0 || versions.length > 0) ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          备份汇总暂未返回目标，已从目标和版本明细恢复当前视图。
        </div>
      ) : null}
      {fallbackError ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          配置备份明细读取失败：{fallbackError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryTile icon={Server} title="备份目标" value={effectiveConfigBackups?.target_count || targets.length} subtext={`${effectiveConfigBackups?.enabled_target_count || 0} 个启用`} />
        <SummaryTile icon={CheckCircle2} title="成功目标" value={targets.filter((target) => getTargetStatus(target) === 'success').length} subtext="最近状态成功" tone="emerald" />
        <SummaryTile icon={AlertTriangle} title="失败目标" value={failedTargets.length} subtext="需要处理" tone={failedTargets.length ? 'rose' : 'default'} />
        <SummaryTile icon={Archive} title="配置版本" value={targets.reduce((sum, target) => sum + Number(target.version_count || 0), 0)} subtext="已保存版本" tone="violet" />
        <SummaryTile icon={Clock3} title="最近备份" value={formatDateTime(effectiveConfigBackups?.latest_backup_at)} subtext={effectiveConfigBackups?.latest_backup_name || '暂无文件'} tone="blue" />
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 xl:grid-cols-[1fr_1fr_160px_160px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <FolderOpen className="h-4 w-4 text-blue-600" />
            宿主机存储目录
          </div>
          <div className="mt-2 truncate font-mono text-sm font-bold text-slate-900">{hostStoragePath}</div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <HardDrive className="h-4 w-4 text-emerald-600" />
            容器存储目录
          </div>
          <div className="mt-2 truncate font-mono text-sm font-bold text-slate-900">{containerStoragePath}</div>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500">文件数量</div>
          <div className="mt-2 text-xl font-black text-slate-900">{effectiveConfigBackups?.total_files || 0}</div>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500">已用空间</div>
          <div className="mt-2 text-xl font-black text-slate-900">{effectiveConfigBackups?.total_size || formatBytes(effectiveConfigBackups?.total_bytes || 0)}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
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

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">版本存储</h3>
              <p className="mt-1 text-sm text-slate-500">最近 {versions.length} 个配置版本，支持在线查看和下载。</p>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">
              路径 = 存储目录 + 相对路径
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">文件名</th>
                  <th className="px-4 py-3 font-bold">完整路径</th>
                  <th className="px-4 py-3 font-bold">大小</th>
                  <th className="px-4 py-3 font-bold">时间</th>
                  <th className="px-4 py-3 font-bold">状态</th>
                  <th className="px-4 py-3 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versions.map((version) => (
                  <tr key={version.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-sm font-bold text-slate-900">{version.filename || '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{version.target_name || version.target || ''}</div>
                    </td>
                    <td className="max-w-[420px] px-4 py-3 align-top">
                      <div className="truncate font-mono text-xs text-slate-600" title={joinBackupPath(hostStoragePath, version.relative_path)}>
                        {joinBackupPath(hostStoragePath, version.relative_path)}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-400" title={joinBackupPath(containerStoragePath, version.relative_path)}>
                        {joinBackupPath(containerStoragePath, version.relative_path)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top font-semibold text-slate-700">{version.size || formatBytes(version.bytes || 0)}</td>
                    <td className="px-4 py-3 align-top text-slate-500">{version.time || formatDateTime(version.time_iso)}</td>
                    <td className="px-4 py-3 align-top">
                      <Pill status={version.status === 'success' ? 'success' : 'failed'} />
                      {version.error_message ? <div className="mt-1 max-w-[220px] truncate text-xs text-rose-600">{version.error_message}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => viewVersion(version)}
                          disabled={busyAction === `view:${version.id}` || version.status !== 'success'}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadVersion(version)}
                          disabled={version.status !== 'success'}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                        >
                          <Download className="h-3.5 w-3.5" />
                          下载
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteVersion(version)}
                          disabled={busyAction === `delete:${version.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {versions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      暂无配置版本。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-base font-black text-slate-900">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              计划与通知
            </div>
            <form className="mt-3 space-y-3" onSubmit={savePolicy}>
              <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                启用计划
                <input
                  type="checkbox"
                  checked={policyForm.enabled}
                  onChange={(event) => setPolicyForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">频率</span>
                  <select
                    value={policyForm.schedule_frequency}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, schedule_frequency: event.target.value }))}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                  >
                    <option value="manual">手动</option>
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">时间</span>
                  <input
                    type="time"
                    value={policyForm.schedule_time}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, schedule_time: event.target.value }))}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                  />
                </label>
              </div>
              {policyForm.schedule_frequency === 'weekly' ? (
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">每周</span>
                  <select
                    value={policyForm.schedule_weekday}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, schedule_weekday: Number(event.target.value) }))}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                  >
                    {WEEKDAY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="block">
                <span className="text-xs font-bold text-slate-500">执行策略</span>
                <select
                  value={policyForm.execution_strategy}
                  onChange={(event) => setPolicyForm((current) => ({ ...current, execution_strategy: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                >
                  <option value="all">全部启用目标</option>
                  <option value="failed">只执行失败设备</option>
                  <option value="device_type">按设备类型</option>
                  <option value="datacenter">按机房</option>
                </select>
              </label>
              {policyForm.execution_strategy === 'device_type' ? (
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">设备类型</span>
                  <select
                    value={policyForm.strategy_device_type}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, strategy_device_type: event.target.value }))}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                  >
                    <option value="">请选择类型</option>
                    {typeOptions.map((type) => <option key={type} value={type}>{DEVICE_TYPE_LABELS[type] || type}</option>)}
                  </select>
                </label>
              ) : null}
              {policyForm.execution_strategy === 'datacenter' ? (
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">机房</span>
                  <select
                    value={policyForm.strategy_datacenter}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, strategy_datacenter: event.target.value }))}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                  >
                    <option value="">请选择机房</option>
                    {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">默认保留版本</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={policyForm.retention_count}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, retention_count: event.target.value }))}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
                  />
                </label>
                <label className="mt-5 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={policyForm.apply_retention_to_targets}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, apply_retention_to_targets: event.target.checked }))}
                  />
                  应用到目标
                </label>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <label className="flex items-center justify-between text-sm font-bold text-slate-700">
                  邮件通知
                  <input
                    type="checkbox"
                    checked={policyForm.email_enabled}
                    onChange={(event) => setPolicyForm((current) => ({ ...current, email_enabled: event.target.checked }))}
                  />
                </label>
                <textarea
                  value={policyForm.email_recipients}
                  onChange={(event) => setPolicyForm((current) => ({ ...current, email_recipients: event.target.value }))}
                  placeholder="admin@example.com, noc@example.com"
                  className="mt-2 min-h-[58px] w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={policyForm.notify_on_success}
                      onChange={(event) => setPolicyForm((current) => ({ ...current, notify_on_success: event.target.checked }))}
                    />
                    成功通知
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={policyForm.notify_on_failure}
                      onChange={(event) => setPolicyForm((current) => ({ ...current, notify_on_failure: event.target.checked }))}
                    />
                    失败通知
                  </label>
                </div>
              </div>
              <div className="rounded-lg bg-slate-950 px-3 py-2">
                <div className="text-xs font-bold text-slate-400">宿主机 cron 建议</div>
                <div className="mt-2 break-all font-mono text-xs leading-5 text-slate-100">
                  {latestPolicy.cron_command || '手动模式不生成 cron 命令'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busyAction === 'policy:save'}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  保存策略
                </button>
                <button
                  type="button"
                  onClick={testEmail}
                  disabled={busyAction === 'policy:test-email'}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                >
                  <Mail className="h-4 w-4" />
                  测试
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-base font-black text-slate-900">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              失败设备
            </div>
            {Array.isArray(effectiveConfigBackups?.failure_summary) && effectiveConfigBackups.failure_summary.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {effectiveConfigBackups.failure_summary.map((item) => (
                  <div key={item.reason} className="rounded-md bg-rose-50 px-2 py-2">
                    <div className="text-xs font-bold text-rose-700">{item.reason}</div>
                    <div className="mt-1 text-lg font-black text-rose-900">{item.count}</div>
                  </div>
                ))}
              </div>
            ) : null}
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
      <VersionContentModal viewer={viewer} onClose={() => setViewer(null)} />
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
