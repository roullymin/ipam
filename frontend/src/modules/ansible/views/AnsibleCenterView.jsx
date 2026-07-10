import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  CopyCheck,
  Database,
  Filter,
  Gauge,
  KeyRound,
  Layers3,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
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
  },
  hosts: [],
  groups: [],
  inventory: '',
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
  other: '其他失败',
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
    <div className="rounded-2xl border border-slate-700/60 bg-white p-4 shadow-sm">
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
        primary ? 'bg-blue-600 text-white' : 'border border-slate-700/70 bg-white text-slate-100',
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [lastAction, setLastAction] = useState(null);
  const [testMode, setTestMode] = useState('login');

  const loadSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await safeFetch('/api/ansible/summary/');
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
  }, []);

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
      if (!query) return true;
      return [
        host.name,
        host.management_ip,
        host.inventory_name,
        host.raw_device_type,
        host.device_type,
        host.datacenter,
        host.rack_code,
        host.location,
        host.credential_name,
        host.username_hint,
      ].some((value) => normalize(value).includes(query));
    });
  }, [groupFilter, hosts, keyword, statusFilter, typeFilter]);

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
      const response = await safeFetch(type === 'test' ? '/api/ansible/test/' : '/api/ansible/provision/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(selected.length ? { host_ids: selected } : {}),
          ...(type === 'test' ? { mode: testMode } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || (type === 'test' ? '批量测试失败' : '批量纳管失败'));
      }
      setLastAction({ type, ...payload });
      const actionLabel = type === 'test' ? (payload.mode === 'readonly' ? '只读命令测试' : '登录测试') : '纳入 Inventory';
      setNotice(`${actionLabel}完成：成功 ${payload.summary?.success ?? payload.summary?.created ?? 0}，失败 ${payload.summary?.failed ?? 0}。`);
      if (type === 'provision') {
        setSelectedIds(new Set());
        await loadSummary();
      }
    } catch (actionError) {
      setError(actionError.message || '操作失败');
    } finally {
      setActionLoading('');
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

  const stats = summary.stats || EMPTY_SUMMARY.stats;
  const inventoryText = summary.inventory || '# 暂无已纳管并绑定凭据的主机';
  const latestResults = asArray(lastAction?.results).slice(0, 10);

  return (
    <div className="ops-page custom-scrollbar h-full overflow-auto p-3 lg:p-4">
      <div className="mx-auto max-w-[1920px] space-y-4">
        <section className="rounded-2xl border border-slate-700/60 bg-white p-5 shadow-sm">
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Server} label="Inventory 主机" value={stats.total_hosts || 0} hint="可参与自动化的资产" />
          <StatCard icon={CheckCircle2} label="已纳管" value={stats.managed_hosts || 0} hint="已有凭据和目标" tone="text-emerald-200" ring="from-emerald-400/20 to-cyan-500/10" />
          <StatCard icon={KeyRound} label="缺少凭据" value={stats.credential_missing || 0} hint="需要先绑定密码本" tone="text-rose-200" ring="from-rose-400/20 to-pink-500/10" />
          <StatCard icon={Database} label="缺少备份目标" value={stats.backup_missing || 0} hint="可批量纳入 Inventory" tone="text-amber-200" ring="from-amber-400/20 to-orange-500/10" />
          <StatCard icon={Layers3} label="分组数量" value={groups.length} hint="按机房、类型、厂商聚合" tone="text-violet-200" ring="from-violet-400/20 to-blue-500/10" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-white shadow-sm">
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
              <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
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
            <section className="rounded-2xl border border-slate-700/60 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-50">Inventory 预览</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">不包含密码，只引用 OpenBao 凭据。</p>
                </div>
                <ActionButton icon={Clipboard} onClick={copyInventory}>复制</ActionButton>
              </div>
              <pre className="custom-scrollbar max-h-[340px] overflow-auto rounded-xl border border-slate-700/60 bg-slate-950/80 p-3 text-xs leading-5 text-cyan-50">
                {inventoryText}
              </pre>
            </section>

            <section className="rounded-2xl border border-slate-700/60 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4 text-cyan-200" />
                <h2 className="text-lg font-black text-slate-50">最近动作</h2>
              </div>
              {lastAction ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(lastAction.summary || {}).filter(([, value]) => Number(value) > 0).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2">
                        <div className="text-[11px] font-bold uppercase text-slate-500">{CATEGORY_LABELS[key] || key}</div>
                        <div className="mt-1 text-xl font-black text-slate-50">{value}</div>
                      </div>
                    ))}
                  </div>
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
                  <div className="mt-3 space-y-2">
                    {latestResults.map((result) => (
                      <ResultLine key={`${result.id}-${result.status}-${result.detail}`} result={result} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-950/30 p-6 text-center">
                  <Gauge className="mx-auto h-7 w-7 text-slate-500" />
                  <div className="mt-2 text-sm font-bold text-slate-400">批量测试或纳管后，这里会显示结果。</div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/60 bg-white p-4 shadow-sm">
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
