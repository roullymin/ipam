import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clipboard,
  CopyCheck,
  Database,
  Download,
  FileText,
  Filter,
  Gauge,
  History,
  KeyRound,
  Layers3,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { safeFetch } from '../../../lib/api';

const EMPTY_SUMMARY = {
  stats: {
    total_hosts: 0,
    managed_hosts: 0,
    unmanaged_hosts: 0,
    credential_missing: 0,
    backup_missing: 0,
    failed_hosts: 0,
    candidate_hosts: 0,
    all_hosts: 0,
    visible_scope: 'managed',
  },
  hosts: [],
  groups: [],
  inventory: '',
  recent_runs: [],
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (Array.isArray(value.results)) return value.results;
  return [];
};

const safeText = (value, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const cx = (...items) => items.filter(Boolean).join(' ');

const STATUS_LABELS = {
  managed: '已纳管',
  unmanaged: '未纳管',
  missing_credential: '缺少凭据',
  failed: '最近失败',
};

const CATEGORY_LABELS = {
  success: '成功',
  auth_failed: '账号或密码错误',
  timeout: '连接超时',
  refused: '端口拒绝',
  unreachable: '网络不可达',
  resolve_failed: '地址无法解析',
  ssh_algorithm: 'SSH 算法不兼容',
  command_failed: '只读命令失败',
  dependency: '后端依赖缺失',
  missing_ip: '缺少管理 IP',
  credential_missing: '缺少凭据',
  skipped: '跳过',
  created: '已创建',
  updated: '已更新',
  other: '其他失败',
};

const RUN_METRIC_LABELS = {
  total: '总数',
  success: '成功',
  planned: '已生成预案',
  failed: '失败',
  skipped: '跳过',
  created: '新增',
  updated: '更新',
  written_back: '回写档案',
  proposed_changes: '采集差异',
  writeback_conflicts: '待确认',
  auth_failed: '认证失败',
  timeout: '超时',
  refused: '端口拒绝',
  unreachable: '不可达',
  resolve_failed: '解析失败',
  ssh_algorithm: '算法不兼容',
  command_failed: '命令失败',
  dependency: '依赖缺失',
  other: '其他',
};

const RUN_METRIC_ORDER = [
  'total',
  'success',
  'planned',
  'created',
  'updated',
  'written_back',
  'proposed_changes',
  'writeback_conflicts',
  'failed',
  'skipped',
  'auth_failed',
  'timeout',
  'ssh_algorithm',
  'unreachable',
  'refused',
  'command_failed',
  'other',
];

const FACT_FIELD_LABELS = {
  hostname: '主机名',
  vendor: '厂商',
  model: '型号',
  serial_number: '序列号',
  version: '系统版本',
  uptime: '运行时长',
  management_ip: '管理 IP',
};

const WRITEBACK_REASON_TONES = {
  empty_current: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  overwrite: 'border-blue-400/30 bg-blue-400/10 text-blue-100',
  invalid_current: 'border-amber-400/35 bg-amber-400/10 text-amber-100',
  status_refresh: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  different_existing: 'border-violet-400/35 bg-violet-400/10 text-violet-100',
};

const formatRunTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDisplayFacts = (host) => {
  const assetFacts = host?.asset_facts || {};
  const latestFacts = host?.latest_fact_run?.facts || {};
  return {
    hostname: assetFacts.hostname || latestFacts.hostname || '',
    vendor: assetFacts.brand || latestFacts.vendor || '',
    model: assetFacts.model || latestFacts.model || '',
    serial_number: assetFacts.serial_number || latestFacts.serial_number || '',
    version: assetFacts.os_version || latestFacts.version || '',
    uptime: latestFacts.uptime || '',
    management_ip: host?.management_ip || latestFacts.management_ip || '',
  };
};

const hasAssetFacts = (host) => {
  const facts = getDisplayFacts(host);
  return Boolean(facts.hostname || facts.model || facts.serial_number || facts.version || facts.vendor);
};

function getHostStatus(host) {
  if (host.last_job_detail || host.backup_status === 'failed') return 'failed';
  if (!host.credential_id) return 'missing_credential';
  return host.managed ? 'managed' : 'unmanaged';
}

function getStatusTone(status) {
  if (status === 'managed') return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200';
  if (status === 'missing_credential') return 'border-rose-400/40 bg-rose-400/10 text-rose-200';
  if (status === 'failed') return 'border-amber-400/40 bg-amber-400/10 text-amber-200';
  return 'border-slate-400/30 bg-slate-400/10 text-slate-200';
}

function StatCard({ icon: Icon, label, value, hint, tone = 'text-cyan-200', ring = 'from-cyan-400/20 to-blue-500/10' }) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black text-slate-400">{label}</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-50">{value}</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">{hint}</div>
        </div>
        <div className={cx('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br', ring)}>
          <Icon className={cx('h-5 w-5', tone)} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ children, tone = 'border-slate-500/30 bg-slate-500/10 text-slate-200' }) {
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black', tone)}>
      {children}
    </span>
  );
}

function ActionButton({ children, icon: Icon, loading, primary, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
        primary
          ? 'border border-cyan-300/50 bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-[0_14px_35px_rgba(37,99,235,0.34)] hover:shadow-[0_16px_42px_rgba(34,211,238,0.28)]'
          : 'border border-cyan-400/20 bg-slate-950/45 text-slate-100 hover:border-cyan-300/45 hover:bg-cyan-400/10',
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function ResultLine({ result }) {
  const ok = result.status === 'success' || result.status === 'created' || result.status === 'updated';
  const commands = asArray(result.commands);
  const facts = result.facts || {};
  const appliedFields = asArray(result.applied_fields);
  const rotationSteps = asArray(result.rotation_steps);
  const writebackPreview = result.writeback_preview || {};
  const writebackSummary = writebackPreview.summary || {};
  const writebackChanges = asArray(writebackPreview.changes);
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-50">{safeText(result.name)}</div>
          <div className="mt-1 truncate font-mono text-xs font-semibold text-slate-400">
            {safeText(result.management_ip)}
          </div>
        </div>
        <StatusPill tone={ok ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200'}>
          {ok ? '成功' : result.status === 'skipped' ? '跳过' : '失败'}
        </StatusPill>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-300">{safeText(result.detail || result.category_label)}</div>
      {rotationSteps.length ? (
        <div className="mt-2 space-y-1.5">
          {rotationSteps.slice(0, 4).map((step, index) => (
            <div key={`${step}-${index}`} className="flex items-start gap-2 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.04] px-2 py-1.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-cyan-400/15 text-[9px] font-black text-cyan-100">
                {index + 1}
              </span>
              <span className="text-[11px] font-semibold leading-4 text-slate-300">{step}</span>
            </div>
          ))}
        </div>
      ) : null}
      {Object.keys(facts).some((key) => facts[key] && key !== 'management_ip') ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {Object.entries(facts)
            .filter(([key, value]) => value && key !== 'management_ip')
            .slice(0, 4)
            .map(([key, value]) => (
              <div key={key} className="rounded-lg border border-cyan-400/10 bg-cyan-400/[0.04] px-2 py-1">
                <div className="text-[10px] font-bold text-slate-500">{FACT_FIELD_LABELS[key] || key}</div>
                <div className="truncate text-[11px] font-black text-slate-200">{value}</div>
              </div>
            ))}
        </div>
      ) : null}
      {writebackChanges.length ? (
        <div className="mt-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.05] p-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black text-violet-100">
            <span>采集差异 {writebackSummary.changes || writebackChanges.length}</span>
            <StatusPill tone="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">可回写 {writebackSummary.writeable || 0}</StatusPill>
            <StatusPill tone="border-amber-400/35 bg-amber-400/10 text-amber-100">待确认 {writebackSummary.conflicts || 0}</StatusPill>
          </div>
          <div className="mt-2 space-y-1">
            {writebackChanges.slice(0, 4).map((change, index) => (
              <div key={`${change.target}-${change.target_id}-${change.field}-${index}`} className="rounded-md border border-slate-700/50 bg-slate-950/35 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-100">{change.label || change.field}</span>
                  <StatusPill tone={WRITEBACK_REASON_TONES[change.reason] || 'border-slate-400/30 bg-slate-400/10 text-slate-200'}>
                    {change.reason_label || (change.will_write ? '将回写' : '待确认')}
                  </StatusPill>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <span className="truncate">{safeText(change.current, '空')}</span>
                  <span className="text-cyan-200">→</span>
                  <span className="truncate text-slate-200">{safeText(change.collected, '空')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {appliedFields.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {appliedFields.slice(0, 5).map((field) => (
            <StatusPill key={field} tone="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
              回写 {field}
            </StatusPill>
          ))}
        </div>
      ) : null}
      {commands.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {commands.slice(0, 3).map((command) => (
            <StatusPill key={command.command} tone="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">
              {command.command}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RunPreviewList({ results = [], limit = 5 }) {
  const items = asArray(results).slice(0, limit);
  if (!items.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {items.map((result, index) => (
        <ResultLine key={`${result.id || index}-${result.status}-${result.management_ip}`} result={result} />
      ))}
    </div>
  );
}

function RunMetricGrid({ summary = {} }) {
  const entries = RUN_METRIC_ORDER
    .map((key) => [key, Number(summary[key] || 0)])
    .filter(([, value]) => value > 0);
  if (!entries.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {entries.slice(0, 6).map(([key, value]) => (
        <div key={key} className="rounded-xl border border-cyan-400/15 bg-slate-950/35 px-3 py-2">
          <div className="text-[11px] font-bold text-slate-400">{RUN_METRIC_LABELS[key] || key}</div>
          <div className="mt-1 text-xl font-black text-slate-50">{value}</div>
        </div>
      ))}
    </div>
  );
}

function FactCell({ host }) {
  const facts = getDisplayFacts(host);
  const latest = host?.latest_fact_run || null;
  const collected = hasAssetFacts(host);
  const primary = facts.hostname || facts.model || facts.version || facts.vendor;
  const secondary = facts.model || facts.serial_number || facts.version || facts.vendor;
  const appliedCount = asArray(latest?.applied_fields).length;
  return (
    <div className="space-y-1.5 text-[11px] font-semibold text-slate-300">
      <StatusPill tone={collected ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-amber-300/40 bg-amber-300/10 text-amber-100'}>
        {collected ? '已采集' : '待采集'}
      </StatusPill>
      <div className="max-w-[220px] truncate text-xs font-black text-slate-100">{safeText(primary, '型号/版本待补全')}</div>
      <div className="max-w-[220px] truncate font-mono text-slate-500">{safeText(secondary, '序列号待补全')}</div>
      {latest ? (
        <div className="max-w-[220px] truncate text-[10px] font-bold text-cyan-200/80">
          最近 {formatRunTime(latest.started_at) || '-'} · 回写 {appliedCount}
        </div>
      ) : null}
    </div>
  );
}

function FactDiffHint({ diffCount, conflictCount }) {
  if (!diffCount) return null;
  return (
    <div className={cx(
      'max-w-[220px] truncate text-[10px] font-black',
      conflictCount ? 'text-amber-200' : 'text-violet-200',
    )}>
      采集差异 {diffCount} · 待确认 {conflictCount}
    </div>
  );
}

export default function AnsibleCenterView() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [factsFilter, setFactsFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [lastAction, setLastAction] = useState(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState(null);
  const [runDetailLoading, setRunDetailLoading] = useState(0);
  const [writebackLoading, setWritebackLoading] = useState(0);
  const [testMode, setTestMode] = useState('login');
  const [scope, setScope] = useState('managed');
  const [rotationBatchSize, setRotationBatchSize] = useState(1);
  const [showInventory, setShowInventory] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await safeFetch(`/api/ansible/summary/?scope=${scope}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || '加载 Ansible 数据失败');
      }
      setSummary(payload?.stats ? payload : EMPTY_SUMMARY);
    } catch (loadError) {
      setSummary(EMPTY_SUMMARY);
      setError(loadError.message || '加载 Ansible 数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [scope]);

  const hosts = asArray(summary.hosts);
  const groups = asArray(summary.groups);

  const typeOptions = useMemo(() => {
    const entries = new Map();
    hosts.forEach((host) => {
      const key = host.device_type || host.raw_device_type || 'unknown';
      entries.set(key, safeText(host.raw_device_type || host.device_type, '未分类'));
    });
    return Array.from(entries.entries()).sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'));
  }, [hosts]);

  const filteredHosts = useMemo(() => {
    const query = normalize(keyword);
    return hosts.filter((host) => {
      const status = getHostStatus(host);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (typeFilter !== 'all' && (host.device_type || host.raw_device_type || 'unknown') !== typeFilter) return false;
      if (groupFilter !== 'all' && !asArray(host.groups).includes(groupFilter)) return false;
      if (factsFilter === 'collected' && !hasAssetFacts(host)) return false;
      if (factsFilter === 'missing' && hasAssetFacts(host)) return false;
      if (factsFilter === 'diff' && !Number(host.latest_fact_run?.writeback_preview?.summary?.changes || 0)) return false;
      if (!query) return true;
      const displayFacts = getDisplayFacts(host);
      const latestFactRun = host.latest_fact_run || {};
      return [
        host.name,
        displayFacts.hostname,
        displayFacts.vendor,
        displayFacts.model,
        displayFacts.serial_number,
        displayFacts.version,
        host.management_ip,
        host.inventory_name,
        host.raw_device_type,
        host.device_type,
        host.datacenter,
        host.rack_code,
        host.location,
        host.credential_name,
        host.username_hint,
        latestFactRun.detail,
      ].some((value) => normalize(value).includes(query));
    });
  }, [factsFilter, groupFilter, hosts, keyword, statusFilter, typeFilter]);

  const resultSummary = useMemo(() => {
    const results = asArray(lastAction?.results);
    return results.reduce((acc, result) => {
      const key = result.category || result.status || 'other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [lastAction]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = filteredHosts.length > 0 && filteredHosts.every((host) => selectedIds.has(host.id));

  const toggleHost = (hostId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(hostId)) next.delete(hostId);
      else next.add(hostId);
      return next;
    });
  };

  const toggleVisibleHosts = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredHosts.forEach((host) => next.delete(host.id));
      } else {
        filteredHosts.forEach((host) => next.add(host.id));
      }
      return next;
    });
  };

  const runHostAction = async (type) => {
    const selected = Array.from(selectedIds);
    if (type === 'provision' && selected.length === 0) {
      setError('请先勾选需要纳入 Inventory 的主机。');
      return;
    }
    setActionLoading(type);
    setError('');
    setNotice('');
    try {
      const endpoint = type === 'test'
        ? '/api/ansible/test/'
        : type === 'collect'
          ? '/api/ansible/collect-facts/'
          : '/api/ansible/provision/';
      const response = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(selected.length ? { host_ids: selected } : {}),
          ...(type === 'test' ? { mode: testMode } : {}),
          ...(type === 'collect' ? { write_back: true, overwrite: false } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fallback = type === 'test' ? '批量测试失败' : type === 'collect' ? '设备信息采集失败' : '批量纳管失败';
        throw new Error(payload.detail || payload.message || fallback);
      }
      setLastAction({ type, ...payload });
      setSelectedRunDetail(null);
      const actionLabel = type === 'test'
        ? (payload.mode === 'readonly' ? '只读命令测试' : '登录测试')
        : type === 'collect'
          ? '设备信息采集'
          : '纳入 Inventory';
      const successValue = payload.summary?.success ?? payload.summary?.created ?? 0;
      const writeBackText = type === 'collect' ? `，回写 ${payload.summary?.written_back ?? 0}` : '';
      setNotice(`${actionLabel}完成：成功 ${successValue}，失败 ${payload.summary?.failed ?? 0}${writeBackText}。`);
      if (type === 'provision' || type === 'collect') {
        setSelectedIds(new Set());
        await loadSummary();
      }
    } catch (actionError) {
      setError(actionError.message || '操作失败');
    } finally {
      setActionLoading('');
    }
  };

  const loadRunDetail = async (run) => {
    if (!run?.id) return;
    setRunDetailLoading(run.id);
    setError('');
    try {
      const response = await safeFetch(`/api/ansible/runs/${run.id}/`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || '加载任务详情失败');
      }
      setSelectedRunDetail(payload.run || null);
    } catch (detailError) {
      setError(detailError.message || '加载任务详情失败');
    } finally {
      setRunDetailLoading(0);
    }
  };

  const confirmRunWriteback = async (run, overwrite = true) => {
    if (!run?.id) return;
    setWritebackLoading(run.id);
    setError('');
    setNotice('');
    try {
      const response = await safeFetch(`/api/ansible/runs/${run.id}/writeback/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: overwrite ? 'overwrite' : 'writeable' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || '确认回写采集信息失败');
      }
      const updatedRun = payload.run || run;
      setSelectedRunDetail(updatedRun);
      setLastAction({
        type: 'writeback',
        summary: payload.summary || updatedRun.summary || {},
        results: asArray(updatedRun.results),
        run: updatedRun,
      });
      setNotice(`采集信息已回写：处理 ${payload.summary?.total ?? 0}，变更 ${payload.summary?.changed ?? 0}。`);
      await loadSummary();
    } catch (writebackError) {
      setError(writebackError.message || '确认回写采集信息失败');
    } finally {
      setWritebackLoading(0);
    }
  };

  const copyInventory = async () => {
    const text = summary.inventory || '';
    if (!text) {
      setNotice('');
      setError('当前没有可复制的 Inventory 内容。');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setError('');
      setNotice('Inventory 已复制到剪贴板。');
    } catch {
      setError('浏览器没有开放剪贴板权限，请从右侧预览框手动复制。');
    }
  };

  const downloadInventory = () => {
    const text = summary.inventory || '';
    if (!text) {
      setNotice('');
      setError('当前没有可下载的 Inventory 内容。');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ansible_inventory_${stamp}.ini`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setError('');
    setNotice('Inventory 文件已生成。');
  };

  const runRotationPlan = async () => {
    const selected = Array.from(selectedIds);
    setActionLoading('rotation');
    setError('');
    setNotice('');
    try {
      const response = await safeFetch('/api/ansible/rotation-plan/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_size: rotationBatchSize,
          ...(selected.length ? { host_ids: selected } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || '生成密码轮换预案失败');
      }
      setLastAction({ type: 'rotation', ...payload });
      setNotice(`密码轮换预案已生成：计划 ${payload.summary?.planned ?? payload.summary?.success ?? 0}，跳过 ${payload.summary?.skipped ?? 0}。`);
      await loadSummary();
    } catch (planError) {
      setError(planError.message || '生成密码轮换预案失败');
    } finally {
      setActionLoading('');
    }
  };

  const stats = summary.stats || EMPTY_SUMMARY.stats;
  const inventoryText = summary.inventory || '# 暂无已纳管并绑定凭据的主机';
  const latestResults = asArray(lastAction?.results).slice(0, 10);
  const recentRuns = asArray(summary.recent_runs);
  const runNeedsWriteback = (run) => {
    const runSummary = run?.summary || {};
    return Number(runSummary.proposed_changes || 0) > 0 || Number(runSummary.writeback_conflicts || 0) > 0;
  };
  const factsSummary = useMemo(() => {
    const collected = Number.isFinite(Number(stats.facts_collected))
      ? Number(stats.facts_collected)
      : hosts.filter((host) => hasAssetFacts(host)).length;
    const missing = Number.isFinite(Number(stats.facts_missing))
      ? Number(stats.facts_missing)
      : Math.max(hosts.length - collected, 0);
    return {
      collected,
      missing,
    };
  }, [hosts, stats.facts_collected, stats.facts_missing]);
  const inventoryGroups = useMemo(
    () => groups.filter((group) => group.name !== 'managed' && group.name !== 'unmanaged').slice(0, 8),
    [groups],
  );

  return (
    <div className="ops-page custom-scrollbar h-full overflow-auto p-3 lg:p-4">
      <div className="mx-auto max-w-[1920px] space-y-4">
        <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-cyan-200">
                <Terminal className="h-4 w-4" />
                Ansible Automation
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-50">Ansible 纳管中心</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                从资产、密码和配置备份目标生成 Inventory，先完成登录验证和只读命令探测，再进入批量纳管。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 rounded-xl border border-slate-700/70 bg-slate-950/40 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setScope('managed');
                    setSelectedIds(new Set());
                  }}
                  className={cx(
                    'rounded-lg px-3 text-xs font-black transition',
                    scope === 'managed' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white',
                  )}
                >
                  纳管池
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScope('all');
                    setSelectedIds(new Set());
                  }}
                  className={cx(
                    'rounded-lg px-3 text-xs font-black transition',
                    scope === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white',
                  )}
                >
                  全部候选
                </button>
              </div>
              <div className="flex h-10 rounded-xl border border-slate-700/70 bg-slate-950/40 p-1">
                <button
                  type="button"
                  onClick={() => setTestMode('login')}
                  className={cx(
                    'rounded-lg px-3 text-xs font-black transition',
                    testMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white',
                  )}
                >
                  登录测试
                </button>
                <button
                  type="button"
                  onClick={() => setTestMode('readonly')}
                  className={cx(
                    'rounded-lg px-3 text-xs font-black transition',
                    testMode === 'readonly' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white',
                  )}
                >
                  只读命令
                </button>
              </div>
              <ActionButton icon={RefreshCw} loading={loading} onClick={loadSummary}>
                刷新
              </ActionButton>
              <ActionButton icon={ShieldCheck} loading={actionLoading === 'test'} onClick={() => runHostAction('test')}>
                {selectedCount ? `测试选中 ${selectedCount}` : '测试已纳管'}
              </ActionButton>
              <ActionButton icon={Database} loading={actionLoading === 'collect'} onClick={() => runHostAction('collect')}>
                {selectedCount ? `采集选中 ${selectedCount}` : '采集已纳管'}
              </ActionButton>
              <ActionButton
                icon={Play}
                primary
                loading={actionLoading === 'provision'}
                disabled={selectedCount === 0}
                onClick={() => runHostAction('provision')}
              >
                纳入选中
              </ActionButton>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100">
            {notice}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <StatCard icon={Server} label="当前池主机" value={stats.total_hosts || 0} hint={scope === 'managed' ? '已隐藏暂不用候选' : '全部可识别候选'} />
          <StatCard icon={CheckCircle2} label="已纳管" value={stats.managed_hosts || 0} hint="已有凭据和目标" tone="text-emerald-200" ring="from-emerald-400/20 to-cyan-500/10" />
          <StatCard icon={Sparkles} label="档案已采集" value={factsSummary.collected} hint={`${factsSummary.missing} 台待补全`} tone="text-cyan-100" ring="from-cyan-400/25 to-blue-500/10" />
          <StatCard icon={KeyRound} label="缺少凭据" value={stats.credential_missing || 0} hint="需要先绑定密码本" tone="text-rose-200" ring="from-rose-400/20 to-pink-500/10" />
          <StatCard icon={Database} label="缺少备份目标" value={stats.backup_missing || 0} hint="可批量纳入 Inventory" tone="text-amber-200" ring="from-amber-400/20 to-orange-500/10" />
          <StatCard icon={Layers3} label="分组数量" value={groups.length} hint="按机房、类型、厂商聚合" tone="text-violet-200" ring="from-violet-400/20 to-blue-500/10" />
          <StatCard icon={Filter} label="暂不用候选" value={stats.candidate_hosts || 0} hint="切到全部候选可查看" tone="text-slate-200" ring="from-slate-400/20 to-cyan-500/10" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="overflow-hidden rounded-2xl border border-cyan-400/15 bg-slate-950/55 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 p-4">
              <div>
                <h2 className="text-lg font-black text-slate-50">主机清单</h2>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  显示 {filteredHosts.length} / {hosts.length} 台，勾选后可批量纳管或按当前模式测试。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="h-10 w-72 max-w-full rounded-xl border border-slate-700/70 bg-slate-950/60 pl-9 pr-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10"
                    placeholder="搜索主机、IP、凭据、位置"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 text-sm font-bold text-slate-100 outline-none"
                >
                  <option value="all">全部状态</option>
                  <option value="managed">已纳管</option>
                  <option value="unmanaged">未纳管</option>
                  <option value="missing_credential">缺少凭据</option>
                  <option value="failed">最近失败</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="h-10 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 text-sm font-bold text-slate-100 outline-none"
                >
                  <option value="all">全部类型</option>
                  {typeOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <select
                  value={factsFilter}
                  onChange={(event) => setFactsFilter(event.target.value)}
                  className="h-10 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 text-sm font-bold text-slate-100 outline-none"
                >
                  <option value="all">全部档案</option>
                  <option value="collected">已采集档案</option>
                  <option value="missing">待采集档案</option>
                  <option value="diff">有采集差异</option>
                </select>
                <select
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                  className="h-10 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 text-sm font-bold text-slate-100 outline-none"
                >
                  <option value="all">全部分组</option>
                  {groups.map((group) => (
                    <option key={group.name} value={group.name}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="custom-scrollbar overflow-auto">
              <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-950/60 text-xs font-black text-slate-400">
                  <tr>
                    <th className="w-10 border-b border-slate-700/60 px-4 py-3">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleHosts} />
                    </th>
                    <th className="border-b border-slate-700/60 px-4 py-3">主机</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">管理 IP</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">类型</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">位置</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">凭据</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">备份目标</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">档案</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">状态</th>
                    <th className="border-b border-slate-700/60 px-4 py-3">分组</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHosts.map((host) => {
                    const status = getHostStatus(host);
                    return (
                      <tr key={host.id} className="border-b border-slate-800/80 transition hover:bg-blue-500/10">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedIds.has(host.id)} onChange={() => toggleHost(host.id)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-50">{safeText(host.name)}</div>
                          <div className="mt-1 font-mono text-xs font-semibold text-slate-500">{safeText(host.inventory_name)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-100">{safeText(host.management_ip)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-300">{safeText(host.raw_device_type || host.device_type)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-300">{safeText(host.location || [host.datacenter, host.rack_code].filter(Boolean).join(' / '))}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-black text-slate-100">{safeText(host.credential_name, '未绑定')}</div>
                          <div className="mt-1 font-mono text-[11px] font-semibold text-slate-500">{safeText(host.username_hint)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-black text-slate-100">{host.backup_target_id ? `#${host.backup_target_id}` : '未创建'}</div>
                          <div className="mt-1 max-w-[220px] truncate text-[11px] font-semibold text-slate-500">{safeText(host.latest_version, '无版本')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <FactCell host={host} />
                          <FactDiffHint
                            diffCount={Number(host.latest_fact_run?.writeback_preview?.summary?.changes || 0)}
                            conflictCount={Number(host.latest_fact_run?.writeback_preview?.summary?.conflicts || 0)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={getStatusTone(status)}>{STATUS_LABELS[status] || status}</StatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1.5">
                            {asArray(host.groups).slice(0, 4).map((group) => (
                              <StatusPill key={group}>{group}</StatusPill>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredHosts.length ? (
                <div className="flex min-h-[220px] items-center justify-center text-sm font-bold text-slate-500">
                  暂无符合条件的 Ansible 主机。
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-1 h-4 w-4 text-cyan-200" />
                  <div>
                    <h2 className="text-lg font-black text-slate-50">Inventory 分组</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-400">默认展示分组概览；原始清单按需展开。</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ActionButton icon={showInventory ? ChevronDown : ChevronRight} onClick={() => setShowInventory((value) => !value)}>
                    {showInventory ? '收起' : '展开'}
                  </ActionButton>
                  <ActionButton icon={Clipboard} onClick={copyInventory}>复制</ActionButton>
                  <ActionButton icon={Download} onClick={downloadInventory}>下载</ActionButton>
                </div>
              </div>
              <div className="grid gap-2">
                {inventoryGroups.length ? inventoryGroups.map((group) => (
                  <div key={group.name} className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-50">{group.name}</div>
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">Inventory 主机分组</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-cyan-100">{group.managed || group.count || 0}</div>
                        <div className="text-[11px] font-bold text-slate-500">台</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-950/30 p-5 text-center text-sm font-bold text-slate-500">
                    暂无 Inventory 分组。
                  </div>
                )}
              </div>
              {showInventory ? (
                <pre className="custom-scrollbar mt-3 max-h-[220px] overflow-auto rounded-xl border border-slate-700/60 bg-slate-950/80 p-3 text-xs leading-5 text-cyan-50">
                  {inventoryText}
                </pre>
              ) : null}
            </section>

            <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-cyan-200" />
                <h2 className="text-lg font-black text-slate-50">任务记录</h2>
              </div>
              {lastAction ? (
                <>
                  <div className="mb-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-50">{lastAction.run?.action_label || lastAction.run?.action || '最近执行'}</div>
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">
                          {formatRunTime(lastAction.run?.started_at)} · {safeText(lastAction.run?.actor_name, '系统')} · 耗时 {lastAction.run?.duration_seconds || 0}s
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {runNeedsWriteback(lastAction.run) ? (
                          <ActionButton
                            icon={CheckCircle2}
                            loading={writebackLoading === lastAction.run?.id}
                            onClick={() => confirmRunWriteback(lastAction.run, true)}
                          >
                            确认回写
                          </ActionButton>
                        ) : null}
                        <StatusPill tone={lastAction.run?.status === 'success' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : lastAction.run?.status === 'partial' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200'}>
                          {lastAction.run?.status_label || lastAction.run?.status || '已记录'}
                        </StatusPill>
                      </div>
                    </div>
                  </div>
                  <RunMetricGrid summary={lastAction.summary} />
                  {Object.keys(resultSummary).length ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {Object.entries(resultSummary).slice(0, 6).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-2 text-xs font-black text-slate-300">
                          <span>{CATEGORY_LABELS[key] || key}</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <RunPreviewList results={latestResults} />
                </>
              ) : recentRuns.length ? (
                <div className="space-y-2">
                  {recentRuns.map((run) => (
                    <div key={run.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-slate-50">{run.action_label || run.action}</div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusPill tone={run.status === 'success' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : run.status === 'partial' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200'}>
                            {run.status_label || run.status}
                          </StatusPill>
                          <button
                            type="button"
                            onClick={() => loadRunDetail(run)}
                            disabled={runDetailLoading === run.id}
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] px-2 text-[11px] font-black text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10 disabled:opacity-60"
                          >
                            {runDetailLoading === run.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                            详情
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs font-semibold leading-5 text-slate-400">{safeText(run.detail)}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black text-slate-500">
                        <span>{formatRunTime(run.started_at)}</span>
                        <span>{safeText(run.actor_name, '系统')}</span>
                        <span>目标 {run.total}</span>
                        <span>成功 {run.success_count}</span>
                        <span>失败 {run.failed_count}</span>
                        <span>耗时 {run.duration_seconds}s</span>
                      </div>
                      <div className="mt-3">
                        <RunMetricGrid summary={run.summary} />
                      </div>
                      <RunPreviewList results={run.results_preview} />
                    </div>
                  ))}
                  {selectedRunDetail ? (
                    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-cyan-100">{selectedRunDetail.action_label || '任务详情'}</div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-400">
                            {formatRunTime(selectedRunDetail.started_at)} · 目标 {selectedRunDetail.total} · 耗时 {selectedRunDetail.duration_seconds || 0}s
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {runNeedsWriteback(selectedRunDetail) ? (
                            <ActionButton
                              icon={CheckCircle2}
                              loading={writebackLoading === selectedRunDetail.id}
                              onClick={() => confirmRunWriteback(selectedRunDetail, true)}
                            >
                              确认回写
                            </ActionButton>
                          ) : null}
                          <StatusPill tone={selectedRunDetail.status === 'success' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : selectedRunDetail.status === 'partial' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200'}>
                            {selectedRunDetail.status_label || selectedRunDetail.status}
                          </StatusPill>
                        </div>
                      </div>
                      <div className="mt-3">
                        <RunMetricGrid summary={selectedRunDetail.summary} />
                      </div>
                      <RunPreviewList results={selectedRunDetail.results} limit={12} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-950/30 p-6 text-center">
                  <Gauge className="mx-auto h-7 w-7 text-slate-500" />
                  <div className="mt-2 text-sm font-bold text-slate-400">批量测试或纳管后，这里会显示结果。</div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-200" />
                <h2 className="text-lg font-black text-slate-50">密码轮换预案</h2>
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                先做流程编排，不自动改设备密码。建议从 1 台开始，确认旧密码、新密码和回滚路径都稳定后再扩大批量。
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 3, 5].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setRotationBatchSize(size)}
                    className={cx(
                      'h-9 rounded-xl border text-xs font-black transition',
                      rotationBatchSize === size
                        ? 'border-cyan-300/70 bg-cyan-400/15 text-cyan-100'
                        : 'border-slate-700/60 bg-slate-950/30 text-slate-300 hover:text-white',
                    )}
                  >
                    {size} 台
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-cyan-100">
                      {selectedCount ? `按已勾选设备生成，最多 ${rotationBatchSize} 台` : `从已纳管设备中取前 ${rotationBatchSize} 台`}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-400">
                      只生成流程和任务记录，不会修改设备密码，也不会覆盖 OpenBao。
                    </div>
                  </div>
                  <ActionButton icon={KeyRound} primary loading={actionLoading === 'rotation'} onClick={runRotationPlan}>
                    生成预案
                  </ActionButton>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ['01', '生成新密码', '生成候选密码，只写入预案，不覆盖 OpenBao。'],
                  ['02', '测试旧密码', '确认当前密码仍可登录，避免误切换。'],
                  ['03', '测试新密码', '设备侧临时验证新密码可用后再进入确认。'],
                  ['04', '确认切换', '人工确认后再更新 OpenBao，并保留回滚记录。'],
                ].map(([index, title, desc]) => (
                  <div key={index} className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-400/15 text-xs font-black text-cyan-100">{index}</span>
                      <span className="text-sm font-black text-slate-50">{title}</span>
                    </div>
                    <div className="mt-2 text-xs font-semibold leading-5 text-slate-400">{desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-cyan-200" />
                <h2 className="text-lg font-black text-slate-50">推荐流程</h2>
              </div>
              <div className="mt-3 space-y-2 text-sm font-semibold text-slate-300">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" />先对 28 台重点设备做登录测试。</div>
                <div className="flex items-center gap-2"><CopyCheck className="h-4 w-4 text-cyan-300" />再跑只读命令，确认模板和 SSH 交互。</div>
                <div className="flex items-center gap-2"><Play className="h-4 w-4 text-violet-300" />成功设备保持纳管，失败设备按分类处理。</div>
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-300" />最后再开放 Playbook 执行。</div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
