import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Database,
  Filter,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Server,
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

const STATUS_LABELS = {
  managed: '已纳管',
  unmanaged: '未纳管',
  missing_credential: '缺少凭据',
  failed: '最近失败',
};

function StatCard({ icon: Icon, label, value, hint, tone = 'text-blue-600', soft = 'bg-blue-50' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{hint}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${soft}`}>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ children, tone = 'bg-slate-100 text-slate-700 ring-slate-200' }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-black ring-1 ${tone}`}>
      {children}
    </span>
  );
}

function getHostStatus(host) {
  if (host.last_job_detail || host.backup_status === 'failed') return 'failed';
  if (!host.credential_id) return 'missing_credential';
  return host.managed ? 'managed' : 'unmanaged';
}

function getStatusTone(status) {
  if (status === 'managed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'missing_credential') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status === 'failed') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function ResultLine({ result }) {
  const ok = result.status === 'success' || result.status === 'created' || result.status === 'updated';
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-900">{safeText(result.name)}</div>
          <div className="mt-1 truncate font-mono text-xs font-semibold text-slate-500">
            {safeText(result.management_ip)}
          </div>
        </div>
        <StatusPill tone={ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}>
          {ok ? '成功' : result.status === 'skipped' ? '跳过' : '失败'}
        </StatusPill>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-600">{safeText(result.detail || result.category_label)}</div>
    </div>
  );
}

export default function AnsibleCenterView() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [lastAction, setLastAction] = useState(null);

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
      window.alert('请先勾选需要纳管的主机。');
      return;
    }
    setActionLoading(type);
    setError('');
    try {
      const response = await safeFetch(type === 'test' ? '/api/ansible/test/' : '/api/ansible/provision/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected.length ? { host_ids: selected } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || (type === 'test' ? '批量测试失败' : '批量纳管失败'));
      }
      setLastAction({ type, ...payload });
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
      window.alert('当前没有可复制的 Inventory 内容。');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      window.alert('Inventory 已复制。');
    } catch {
      window.alert(text);
    }
  };

  const stats = summary.stats || EMPTY_SUMMARY.stats;
  const inventoryText = summary.inventory || '# 暂无已纳管并绑定凭据的主机';
  const latestResults = asArray(lastAction?.results).slice(0, 8);

  return (
    <div className="ops-page h-full overflow-auto bg-slate-100 p-3 lg:p-4">
      <div className="mx-auto max-w-[1920px] space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700">
                <Terminal className="h-4 w-4" />
                Ansible Automation
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Ansible 纳管中心</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                从资产、密码和配置备份目标生成 Inventory，集中完成登录测试与批量纳管。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadSummary}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
              <button
                type="button"
                onClick={() => runHostAction('test')}
                disabled={actionLoading === 'test'}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {selectedCount ? `测试选中 ${selectedCount}` : '测试已纳管'}
              </button>
              <button
                type="button"
                onClick={() => runHostAction('provision')}
                disabled={actionLoading === 'provision' || selectedCount === 0}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === 'provision' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                纳入选中
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Server} label="Inventory 主机" value={stats.total_hosts || 0} hint="可参与自动化的资产" />
          <StatCard icon={CheckCircle2} label="已纳管" value={stats.managed_hosts || 0} hint="已绑定凭据和目标" tone="text-emerald-600" soft="bg-emerald-50" />
          <StatCard icon={AlertTriangle} label="缺少凭据" value={stats.credential_missing || 0} hint="需先绑定密码本" tone="text-rose-600" soft="bg-rose-50" />
          <StatCard icon={Database} label="缺少备份目标" value={stats.backup_missing || 0} hint="可批量纳入 Inventory" tone="text-amber-600" soft="bg-amber-50" />
          <StatCard icon={Layers3} label="分组数量" value={groups.length} hint="按机房、类型、厂商聚合" tone="text-violet-600" soft="bg-violet-50" />
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
              <div>
                <h2 className="text-base font-black text-slate-950">主机清单</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  显示 {filteredHosts.length} / {hosts.length} 台，勾选后可批量纳管或测试。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="h-9 w-72 max-w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    placeholder="搜索主机、IP、凭据、位置"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
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
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
                >
                  <option value="all">全部类型</option>
                  {typeOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <select
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
                >
                  <option value="all">全部分组</option>
                  {groups.map((group) => (
                    <option key={group.name} value={group.name}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="w-10 border-b border-slate-200 px-3 py-3">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleHosts} />
                    </th>
                    <th className="border-b border-slate-200 px-3 py-3">主机</th>
                    <th className="border-b border-slate-200 px-3 py-3">管理 IP</th>
                    <th className="border-b border-slate-200 px-3 py-3">类型</th>
                    <th className="border-b border-slate-200 px-3 py-3">位置</th>
                    <th className="border-b border-slate-200 px-3 py-3">凭据</th>
                    <th className="border-b border-slate-200 px-3 py-3">备份目标</th>
                    <th className="border-b border-slate-200 px-3 py-3">状态</th>
                    <th className="border-b border-slate-200 px-3 py-3">分组</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHosts.map((host) => {
                    const status = getHostStatus(host);
                    return (
                      <tr key={host.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={selectedIds.has(host.id)} onChange={() => toggleHost(host.id)} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-black text-slate-900">{safeText(host.name)}</div>
                          <div className="mt-1 font-mono text-xs font-semibold text-slate-500">{safeText(host.inventory_name)}</div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs font-bold text-slate-700">{safeText(host.management_ip)}</td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-600">{safeText(host.raw_device_type || host.device_type)}</td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-600">{safeText(host.location || [host.datacenter, host.rack_code].filter(Boolean).join(' / '))}</td>
                        <td className="px-3 py-3">
                          <div className="text-xs font-black text-slate-800">{safeText(host.credential_name, '未绑定')}</div>
                          <div className="mt-1 font-mono text-[11px] font-semibold text-slate-500">{safeText(host.username_hint)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs font-black text-slate-800">{host.backup_target_id ? `#${host.backup_target_id}` : '未创建'}</div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-500">{safeText(host.latest_version, '无版本')}</div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={getStatusTone(status)}>{STATUS_LABELS[status] || status}</StatusPill>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1">
                            {asArray(host.groups).slice(0, 3).map((group) => (
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
                <div className="flex min-h-[220px] items-center justify-center text-sm font-bold text-slate-400">
                  暂无符合条件的 Ansible 主机。
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-3">
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-950">Inventory 预览</h2>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">不包含密码，只引用 OpenBao 凭据。</p>
                </div>
                <button
                  type="button"
                  onClick={copyInventory}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  复制
                </button>
              </div>
              <pre className="max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {inventoryText}
              </pre>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <h2 className="text-base font-black text-slate-950">最近动作</h2>
              </div>
              {lastAction ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(lastAction.summary || {}).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-bold uppercase text-slate-400">{key}</div>
                        <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {latestResults.map((result) => (
                      <ResultLine key={`${result.id}-${result.status}-${result.detail}`} result={result} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                  批量测试或纳管后，这里会显示结果。
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
