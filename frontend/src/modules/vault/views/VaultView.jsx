import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Eye,
  FileKey,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import { safeFetch } from '../../../lib/api';


const EMPTY_FORM = {
  name: '',
  credential_type: 'ssh',
  target_type: 'general',
  datacenter: '',
  rack: '',
  rack_device: '',
  ip_address: '',
  secret_username: '',
  secret_value: '',
  owner_team: '',
  environment: 'production',
  sensitivity: 'confidential',
  expires_at: '',
  rotation_days: 90,
  status: 'active',
  notes: '',
};

const unwrap = (payload) => (Array.isArray(payload) ? payload : payload?.results || []);
const formatTime = (value) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');
const labels = {
  ssh: 'SSH',
  database: '数据库',
  web: 'Web 后台',
  api_key: 'API Key',
  device: '设备账号',
  other: '其他',
  production: '生产',
  test: '测试',
  development: '开发',
  internal: '内部',
  confidential: '机密',
  restricted: '严格受限',
  active: '有效',
  disabled: '停用',
  expired: '已过期',
  expiring: '即将到期',
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  used: '已使用',
  request: '申请',
  approve: '批准',
  reject: '驳回',
  reveal: '查看',
  create: '创建',
  update: '更新',
  delete: '删除',
  rotate: '轮换',
  success: '成功',
  denied: '拒绝',
  error: '错误',
};

async function readError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  const fieldMessage = Object.values(payload || {}).flat().find(Boolean);
  return payload.detail || payload.message || fieldMessage || fallback;
}

function Modal({ title, children, onClose, width = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full ${width} overflow-auto rounded-3xl border border-white/80 bg-white shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ value }) {
  const tone = value === 'active' || value === 'approved' || value === 'success'
    ? 'bg-emerald-50 text-emerald-700'
    : value === 'pending' || value === 'expiring'
      ? 'bg-amber-50 text-amber-700'
      : value === 'used'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-rose-50 text-rose-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{labels[value] || value}</span>;
}

export default function VaultView({ currentRole }) {
  const [activeSheet, setActiveSheet] = useState('ledger');
  const [secrets, setSecrets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [audits, setAudits] = useState([]);
  const [assets, setAssets] = useState({ datacenters: [], racks: [], devices: [], ips: [] });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessForm, setAccessForm] = useState({ reason: '', current_password: '' });
  const [revealResult, setRevealResult] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const isAdmin = currentRole === 'admin';
  const canReveal = ['admin', 'dc_operator', 'ip_manager'].includes(currentRole);
  const canAudit = ['admin', 'auditor'].includes(currentRole);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const resources = [
      ['secrets', '/api/secrets/'],
      ['requests', '/api/secret-access-requests/'],
      ['datacenters', '/api/datacenters/'],
      ['racks', '/api/racks/'],
      ['devices', '/api/rack-devices/'],
      ['ips', '/api/ips/'],
    ];
    if (canAudit) resources.push(['audits', '/api/secret-audit-events/']);
    const results = await Promise.all(resources.map(async ([key, url]) => {
      const response = await safeFetch(url);
      return [key, response, response.ok ? unwrap(await response.json().catch(() => [])) : []];
    }));
    const mapped = Object.fromEntries(results.map(([key, , data]) => [key, data]));
    const secretResponse = results.find(([key]) => key === 'secrets')?.[1];
    if (!secretResponse?.ok) setError(await readError(secretResponse, '密码台账加载失败。'));
    setSecrets(mapped.secrets || []);
    setRequests(mapped.requests || []);
    setAudits(mapped.audits || []);
    setAssets({
      datacenters: mapped.datacenters || [],
      racks: mapped.racks || [],
      devices: mapped.devices || [],
      ips: mapped.ips || [],
    });
    setLoading(false);
  }, [canAudit]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!countdown) {
      if (revealResult) setRevealResult(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, revealResult]);

  const filteredSecrets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return secrets;
    return secrets.filter((item) => [
      item.name, item.username_hint, item.owner_team, item.target_display, item.notes,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [search, secrets]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowEditor(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      ...EMPTY_FORM,
      ...item,
      datacenter: item.datacenter || '',
      rack: item.rack || '',
      rack_device: item.rack_device || '',
      ip_address: item.ip_address || '',
      secret_username: item.username_hint || '',
      secret_value: '',
      expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '',
    });
    setShowEditor(true);
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      ...form,
      rotation_days: Number(form.rotation_days || 90),
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      datacenter: form.datacenter || null,
      rack: form.rack || null,
      rack_device: form.rack_device || null,
      ip_address: form.ip_address || null,
    };
    if (editing && !payload.secret_value) {
      delete payload.secret_username;
      delete payload.secret_value;
    }
    const response = await safeFetch(editing ? `/api/secrets/${editing.id}/` : '/api/secrets/', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError(await readError(response, '保存失败。'));
      setBusy(false);
      return;
    }
    setShowEditor(false);
    setBusy(false);
    await loadData();
  };

  const deleteRecord = async (item) => {
    if (!window.confirm(`确定删除“${item.name}”吗？OpenBao 中的密文也会一并删除。`)) return;
    setBusy(true);
    const response = await safeFetch(`/api/secrets/${item.id}/`, { method: 'DELETE' });
    if (!response.ok) setError(await readError(response, '删除失败。'));
    setBusy(false);
    await loadData();
  };

  const submitAccess = async (mode) => {
    if (!accessTarget) return;
    setBusy(true);
    const url = mode === 'request'
      ? `/api/secrets/${accessTarget.id}/request-access/`
      : `/api/secrets/${accessTarget.id}/reveal/`;
    const response = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accessForm),
    });
    if (!response.ok) {
      setError(await readError(response, mode === 'request' ? '申请失败。' : '查看失败。'));
      setBusy(false);
      return;
    }
    if (mode === 'reveal') {
      const payload = await response.json();
      setRevealResult(payload);
      setCountdown(payload.expires_in || 30);
    } else {
      setAccessTarget(null);
      setAccessForm({ reason: '', current_password: '' });
      await loadData();
    }
    setBusy(false);
  };

  const reviewRequest = async (item, approve) => {
    const comment = window.prompt(approve ? '审批意见（可留空）' : '请输入驳回原因') || '';
    if (!approve && !comment) return;
    setBusy(true);
    const response = await safeFetch(`/api/secret-access-requests/${item.id}/${approve ? 'approve' : 'reject'}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_comment: comment, valid_minutes: 30 }),
    });
    if (!response.ok) setError(await readError(response, '审批失败。'));
    setBusy(false);
    await loadData();
  };

  const copySecret = async () => {
    if (!revealResult?.secret_value) return;
    await navigator.clipboard.writeText(revealResult.secret_value);
  };

  const targetOptions = form.target_type === 'datacenter'
    ? assets.datacenters.map((item) => [item.id, item.name])
    : form.target_type === 'rack'
      ? assets.racks.map((item) => [item.id, `${item.code}${item.name ? ` / ${item.name}` : ''}`])
      : form.target_type === 'device'
        ? assets.devices.map((item) => [item.id, `${item.name}${item.mgmt_ip ? ` / ${item.mgmt_ip}` : ''}`])
        : form.target_type === 'ip'
          ? assets.ips.map((item) => [item.id, item.ip_address])
          : [];
  const targetField = { datacenter: 'datacenter', rack: 'rack', device: 'rack_device', ip: 'ip_address' }[form.target_type];

  return (
    <div className="h-full overflow-auto bg-slate-50/70 p-5 lg:p-7">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <section className="rounded-3xl border border-white bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-xl shadow-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-cyan-300"><ShieldCheck size={18} /><span className="text-sm font-semibold">OpenBao 密文托管</span></div>
              <h2 className="text-2xl font-black">密码本与特权凭据台账</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">像 Excel 一样管理台账，但密码不进入数据库。取用经过二次验证、审批和全程审计。</p>
            </div>
            <div className="flex gap-3">
              <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15"><RefreshCw size={16} />刷新</button>
              {isAdmin && <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"><Plus size={17} />新增密码</button>}
            </div>
          </div>
        </section>

        {error && <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertTriangle size={17} />{error}<button onClick={() => setError('')} className="ml-auto"><X size={16} /></button></div>}

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ['台账总数', secrets.length, KeyRound, 'text-cyan-700 bg-cyan-50'],
            ['待审批', requests.filter((item) => item.status === 'pending').length, FileKey, 'text-amber-700 bg-amber-50'],
            ['即将到期', secrets.filter((item) => item.lifecycle_status === 'expiring').length, AlertTriangle, 'text-orange-700 bg-orange-50'],
            ['已停用/过期', secrets.filter((item) => ['disabled', 'expired'].includes(item.lifecycle_status)).length, ShieldCheck, 'text-rose-700 bg-rose-50'],
          ].map(([title, value, Icon, tone]) => (
            <div key={title} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className={`mb-3 inline-flex rounded-xl p-2.5 ${tone}`}><Icon size={19} /></div>
              <div className="text-2xl font-black text-slate-900">{value}</div>
              <div className="text-sm text-slate-500">{title}</div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 pt-4">
            {[['ledger', '密码台账'], ['requests', '取用审批'], ...(canAudit ? [['audits', '审计记录']] : [])].map(([key, label]) => (
              <button key={key} onClick={() => setActiveSheet(key)} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeSheet === key ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-slate-500'}`}>{label}</button>
            ))}
            {activeSheet === 'ledger' && (
              <label className="ml-auto mb-3 flex min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search size={16} className="text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称、账号、对象、团队" className="w-full bg-transparent text-sm outline-none" />
              </label>
            )}
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={20} />正在加载密码本...</div>
          ) : activeSheet === 'ledger' ? (
            <div className="overflow-x-auto">
              <table className="min-w-[1450px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{['序号', '名称', '类型', '关联对象', '账号提示', '环境', '敏感级别', '责任团队', '到期时间', '轮换周期', '状态', '操作'].map((head) => <th key={head} className="border-b border-r border-slate-200 px-3 py-3 font-bold">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredSecrets.map((item, index) => (
                    <tr key={item.id} className="hover:bg-cyan-50/40">
                      <td className="border-b border-r border-slate-100 px-3 py-3 text-slate-400">{index + 1}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3 font-bold text-slate-900">{item.name}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{labels[item.credential_type]}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{item.target_display}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3 font-mono text-xs">{item.username_hint || '-'}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{labels[item.environment]}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{labels[item.sensitivity]}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{item.owner_team || '-'}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{formatTime(item.expires_at)}</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3">{item.rotation_days} 天</td>
                      <td className="border-b border-r border-slate-100 px-3 py-3"><StatusPill value={item.lifecycle_status} /></td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex gap-1">
                          {canReveal && <button onClick={() => { setAccessTarget(item); setAccessForm({ reason: '', current_password: '' }); setRevealResult(null); }} className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50" title="查看 / 申请"><Eye size={16} /></button>}
                          {isAdmin && <button onClick={() => openEdit(item)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">编辑</button>}
                          {isAdmin && <button onClick={() => deleteRecord(item)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="删除"><Trash2 size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredSecrets.length && <div className="p-12 text-center text-sm text-slate-500">暂无密码台账记录。</div>}
            </div>
          ) : activeSheet === 'requests' ? (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-500"><tr>{['密码条目', '申请人', '原因', '申请时间', '状态', '审批人', '授权到期', '操作'].map((head) => <th key={head} className="border-b border-r border-slate-200 px-4 py-3">{head}</th>)}</tr></thead>
                <tbody>{requests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="border-b border-r border-slate-100 px-4 py-3 font-semibold">{item.secret_name}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3">{item.requester_name}</td>
                    <td className="max-w-xs border-b border-r border-slate-100 px-4 py-3">{item.reason}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3">{formatTime(item.created_at)}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3"><StatusPill value={item.status} /></td>
                    <td className="border-b border-r border-slate-100 px-4 py-3">{item.reviewed_by_name || '-'}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3">{formatTime(item.approved_expires_at)}</td>
                    <td className="border-b border-slate-100 px-4 py-3">{isAdmin && item.status === 'pending' ? <div className="flex gap-2"><button onClick={() => reviewRequest(item, true)} className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Check size={15} /></button><button onClick={() => reviewRequest(item, false)} className="rounded-lg bg-rose-50 p-2 text-rose-700"><X size={15} /></button></div> : '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-500"><tr>{['时间', '密码条目', '用户', '动作', '结果', '原因 / 说明', '来源 IP'].map((head) => <th key={head} className="border-b border-r border-slate-200 px-4 py-3">{head}</th>)}</tr></thead>
                <tbody>{audits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="border-b border-r border-slate-100 px-4 py-3">{formatTime(item.created_at)}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3 font-semibold">{item.secret_name}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3">{item.username || '-'}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3">{labels[item.action] || item.action}</td>
                    <td className="border-b border-r border-slate-100 px-4 py-3"><StatusPill value={item.result} /></td>
                    <td className="max-w-md border-b border-r border-slate-100 px-4 py-3">{item.reason || '-'}</td>
                    <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs">{item.ip_address || '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showEditor && (
        <Modal title={editing ? '编辑密码台账' : '新增密码台账'} onClose={() => setShowEditor(false)} width="max-w-4xl">
          <form onSubmit={saveRecord} className="grid gap-4 md:grid-cols-2">
            {[
              ['name', '名称', 'text'],
              ['owner_team', '责任团队', 'text'],
            ].map(([field, label, type]) => <label key={field} className="space-y-1.5 text-sm font-semibold text-slate-700">{label}<input type={type} required={field === 'name'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-cyan-500" /></label>)}
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">凭据类型<select value={form.credential_type} onChange={(event) => setForm({ ...form, credential_type: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">{['ssh', 'database', 'web', 'api_key', 'device', 'other'].map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">关联类型<select value={form.target_type} onChange={(event) => setForm({ ...form, target_type: event.target.value, datacenter: '', rack: '', rack_device: '', ip_address: '' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">{[['general', '通用'], ['datacenter', '机房'], ['rack', '机柜'], ['device', '设备'], ['ip', 'IP 地址']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {targetField && <label className="space-y-1.5 text-sm font-semibold text-slate-700">关联对象<select required value={form[targetField]} onChange={(event) => setForm({ ...form, [targetField]: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">请选择</option>{targetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">环境<select value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">{['production', 'test', 'development', 'other'].map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">敏感级别<select value={form.sensitivity} onChange={(event) => setForm({ ...form, sensitivity: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">{['internal', 'confidential', 'restricted'].map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">账号<input value={form.secret_username} onChange={(event) => setForm({ ...form, secret_username: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">{editing ? '新密码 / 密钥（不修改可留空）' : '密码 / 密钥'}<input type="password" required={!editing} value={form.secret_value} onChange={(event) => setForm({ ...form, secret_value: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" autoComplete="new-password" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">到期时间<input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">轮换周期（天）<input type="number" min="1" value={form.rotation_days} onChange={(event) => setForm({ ...form, rotation_days: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">备注<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
            <div className="flex justify-end gap-3 md:col-span-2"><button type="button" onClick={() => setShowEditor(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold">取消</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />}保存</button></div>
          </form>
        </Modal>
      )}

      {accessTarget && (
        <Modal title={`取用：${accessTarget.name}`} onClose={() => { setAccessTarget(null); setRevealResult(null); setCountdown(0); }} width="max-w-lg">
          {revealResult ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">敏感内容将在 {countdown} 秒后从页面内存中清除，请勿截图或转发。</div>
              <div><div className="mb-1 text-xs font-bold text-slate-500">账号</div><div className="rounded-xl bg-slate-100 p-3 font-mono">{revealResult.username || '-'}</div></div>
              <div><div className="mb-1 text-xs font-bold text-slate-500">密码 / 密钥</div><div className="break-all rounded-xl bg-slate-950 p-4 font-mono text-cyan-300">{revealResult.secret_value}</div></div>
              <button onClick={copySecret} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white"><Clipboard size={17} />复制到剪贴板</button>
            </div>
          ) : (
            <div className="space-y-4">
              {!isAdmin && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">非管理员需先提交取用申请。批准后授权有效 30 分钟，成功查看一次即失效。</div>}
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">用途 / 原因<textarea value={accessForm.reason} onChange={(event) => setAccessForm({ ...accessForm, reason: event.target.value })} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">当前登录密码<input type="password" value={accessForm.current_password} onChange={(event) => setAccessForm({ ...accessForm, current_password: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" autoComplete="current-password" /></label>
              <div className="grid grid-cols-2 gap-3">
                {!isAdmin && <button disabled={busy || !accessForm.reason} onClick={() => submitAccess('request')} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 font-bold text-cyan-700 disabled:opacity-50">提交申请</button>}
                <button disabled={busy || !accessForm.reason || !accessForm.current_password} onClick={() => submitAccess('reveal')} className={`${isAdmin ? 'col-span-2' : ''} inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50`}><Eye size={17} />二次验证并查看</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
