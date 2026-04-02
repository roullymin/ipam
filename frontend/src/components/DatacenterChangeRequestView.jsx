import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Copy, Plus, RefreshCw, XCircle } from 'lucide-react';

import { FormInput, Modal, StatusBadge } from './common/UI';
import { safeFetch } from '../lib/api';

const STATUS_STYLES = {
  draft: { label: '草稿', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  submitted: { label: '待审批', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  approved: { label: '已批准', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { label: '已驳回', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  scheduled: { label: '待执行', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  completed: { label: '已完成', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  cancelled: { label: '已取消', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-300' },
};

const REQUEST_TYPES = [
  ['rack_in', '设备上架'],
  ['rack_out', '设备下架'],
  ['move_in', '设备搬入'],
  ['move_out', '设备搬出'],
  ['relocate', '位置迁移'],
  ['decommission', '设备退役'],
  ['power_change', '电力变更'],
];

const NETWORK_ROLES = [
  ['none', '无需网络'],
  ['management', '管理网络'],
  ['service', '业务网络'],
  ['dual', '双网'],
];

const IP_ACTIONS = [
  ['allocate', '新分配'],
  ['keep', '保留原 IP'],
  ['change', '变更 IP'],
  ['release', '释放旧 IP'],
  ['none', '不涉及'],
];

const EMPTY_FORM = {
  request_type: 'rack_in',
  title: '',
  applicant_name: '',
  applicant_phone: '',
  company: '',
  department: '',
  project_name: '',
  reason: '',
  item: {
    device_name: '',
    device_model: '',
    serial_number: '',
    quantity: 1,
    u_height: 1,
    power_watts: 0,
    network_role: 'none',
    ip_quantity: 0,
    requires_static_ip: false,
    ip_action: 'allocate',
    source_datacenter: '',
    source_rack: '',
    source_u_start: '',
    source_u_end: '',
    target_datacenter: '',
    target_rack: '',
    target_u_start: '',
    target_u_end: '',
    notes: '',
  },
};

const normalizeList = (payload) => (Array.isArray(payload) ? payload : payload?.results || []);

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-[26px] font-black leading-none text-slate-900">{value}</div>
    </div>
  );
}

function RackHint({ rack, title }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
      <div className="font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</div>
      {rack ? (
        <>
          <div className="mt-2 text-sm font-bold text-slate-800">{rack.name || rack.code}</div>
          <div className="mt-1">高度 {rack.height}U，已占用 {rack.occupied_ranges.length} 段</div>
        </>
      ) : (
        <div className="mt-2">请选择机房和机柜后查看占用情况。</div>
      )}
    </div>
  );
}

export default function DatacenterChangeRequestView() {
  const [requests, setRequests] = useState([]);
  const [topology, setTopology] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [listResponse, topologyResponse] = await Promise.all([
        safeFetch('/api/datacenter-change-requests/'),
        safeFetch('/api/datacenter-change-requests/topology/'),
      ]);
      const listPayload = await listResponse.json();
      const topologyPayload = await topologyResponse.json();
      if (!listResponse.ok) throw new Error(listPayload.detail || listPayload.message || '加载申请列表失败');
      if (!topologyResponse.ok) throw new Error(topologyPayload.detail || topologyPayload.message || '加载机房拓扑失败');
      setRequests(normalizeList(listPayload));
      setTopology(topologyPayload.datacenters || []);
    } catch (err) {
      setError(err.message || '加载机房设备变更申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => ({
    total: requests.length,
    submitted: requests.filter((item) => item.status === 'submitted').length,
    approved: requests.filter((item) => item.status === 'approved').length,
    completed: requests.filter((item) => item.status === 'completed').length,
  }), [requests]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setItemField = (key, value) => setForm((prev) => ({ ...prev, item: { ...prev.item, [key]: value } }));

  const sourceDatacenter = topology.find((item) => String(item.id) === String(form.item.source_datacenter));
  const targetDatacenter = topology.find((item) => String(item.id) === String(form.item.target_datacenter));
  const sourceRack = sourceDatacenter?.racks?.find((item) => String(item.id) === String(form.item.source_rack));
  const targetRack = targetDatacenter?.racks?.find((item) => String(item.id) === String(form.item.target_rack));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        request_type: form.request_type,
        title: form.title,
        applicant_name: form.applicant_name,
        applicant_phone: form.applicant_phone,
        company: form.company,
        department: form.department,
        project_name: form.project_name,
        reason: form.reason,
        items: [{
          ...form.item,
          quantity: Number(form.item.quantity || 1),
          u_height: Number(form.item.u_height || 1),
          power_watts: Number(form.item.power_watts || 0),
          ip_quantity: Number(form.item.ip_quantity || 0),
          source_datacenter: form.item.source_datacenter || null,
          source_rack: form.item.source_rack || null,
          source_u_start: form.item.source_u_start || null,
          source_u_end: form.item.source_u_end || null,
          target_datacenter: form.item.target_datacenter || null,
          target_rack: form.item.target_rack || null,
          target_u_start: form.item.target_u_start || null,
          target_u_end: form.item.target_u_end || null,
        }],
      };

      const response = await safeFetch('/api/datacenter-change-requests/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.message || '创建申请失败');
      setNotice(`申请已提交：${result.request_code}`);
      setOpen(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err.message || '创建申请失败');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id, action, message) => {
    setError('');
    try {
      const response = await safeFetch(`/api/datacenter-change-requests/${id}/${action}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.message || '操作失败');
      setNotice(message);
      await loadData();
    } catch (err) {
      setError(err.message || '操作失败');
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('公开申请链接已复制');
    } catch {
      setError('复制链接失败，请手动复制');
    }
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-600">
                <ArrowLeftRight className="h-4 w-4" />
                机房设备变更申请中心
              </div>
              <h2 className="mt-3 text-[30px] font-black tracking-tight text-slate-900">上架、下架、搬入、搬出统一入口</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                这一版先提供最小可用闭环：创建申请、审批、独立链接，以及机房 / 机柜 / U 位联动。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
                <RefreshCw className="h-4 w-4" />
                刷新
              </button>
              <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700" type="button">
                <Plus className="h-4 w-4" />
                新建申请
              </button>
            </div>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="总申请数" value={summary.total} />
          <SummaryCard label="待审批" value={summary.submitted} />
          <SummaryCard label="已批准" value={summary.approved} />
          <SummaryCard label="已完成" value={summary.completed} />
        </div>

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-black text-slate-900">申请列表</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-bold">申请信息</th>
                  <th className="px-6 py-4 font-bold">类型</th>
                  <th className="px-6 py-4 font-bold">申请人</th>
                  <th className="px-6 py-4 font-bold">设备</th>
                  <th className="px-6 py-4 font-bold">状态</th>
                  <th className="px-6 py-4 font-bold">链接</th>
                  <th className="px-6 py-4 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">正在加载...</td></tr> : null}
                {!loading && !requests.length ? <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">当前还没有机房设备变更申请。</td></tr> : null}
                {requests.map((request) => {
                  const typeLabel = REQUEST_TYPES.find((item) => item[0] === request.request_type)?.[1] || request.request_type;
                  const item = request.items?.[0];
                  return (
                    <tr key={request.id} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4"><div className="font-semibold text-slate-900">{request.title}</div><div className="mt-1 text-xs text-slate-500">{request.request_code}</div></td>
                      <td className="px-6 py-4 text-slate-700">{typeLabel}</td>
                      <td className="px-6 py-4"><div className="font-semibold text-slate-800">{request.applicant_name}</div><div className="mt-1 text-xs text-slate-500">{request.applicant_phone || '未填写电话'}</div></td>
                      <td className="px-6 py-4"><div className="font-semibold text-slate-800">{item?.device_name || '未填写设备'}</div><div className="mt-1 text-xs text-slate-500">{item?.device_model || '未填写型号'}</div></td>
                      <td className="px-6 py-4"><StatusBadge status={request.status} styles={STATUS_STYLES} /></td>
                      <td className="px-6 py-4"><button onClick={() => copyLink(request.public_link)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button">复制链接</button></td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {request.status === 'submitted' ? (
                            <>
                              <button onClick={() => runAction(request.id, 'approve', `申请 ${request.request_code} 已批准`)} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700" type="button"><CheckCircle2 className="h-3.5 w-3.5" />批准</button>
                              <button onClick={() => runAction(request.id, 'reject', `申请 ${request.request_code} 已驳回`)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" type="button"><XCircle className="h-3.5 w-3.5" />驳回</button>
                            </>
                          ) : null}
                          <button onClick={() => runAction(request.id, 'regenerate_link', `申请 ${request.request_code} 的公开链接已重置`)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button">重置链接</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="新建机房设备变更申请" size="xl">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">申请类型</label><select value={form.request_type} onChange={(event) => setField('request_type', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{REQUEST_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <FormInput label="申请标题" value={form.title} onChange={(event) => setField('title', event.target.value)} required />
            <FormInput label="申请人" value={form.applicant_name} onChange={(event) => setField('applicant_name', event.target.value)} required />
            <FormInput label="联系电话" value={form.applicant_phone} onChange={(event) => setField('applicant_phone', event.target.value)} />
            <FormInput label="所属单位" value={form.company} onChange={(event) => setField('company', event.target.value)} />
            <FormInput label="所属部门" value={form.department} onChange={(event) => setField('department', event.target.value)} />
            <FormInput label="所属项目" value={form.project_name} onChange={(event) => setField('project_name', event.target.value)} />
          </div>

          <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">申请原因</label><textarea value={form.reason} onChange={(event) => setField('reason', event.target.value)} className="h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-sm font-bold text-slate-900">设备与网络需求</div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput label="设备名称" value={form.item.device_name} onChange={(event) => setItemField('device_name', event.target.value)} required />
              <FormInput label="设备型号" value={form.item.device_model} onChange={(event) => setItemField('device_model', event.target.value)} />
              <FormInput label="序列号" value={form.item.serial_number} onChange={(event) => setItemField('serial_number', event.target.value)} />
              <FormInput label="数量" type="number" min="1" value={form.item.quantity} onChange={(event) => setItemField('quantity', event.target.value)} />
              <FormInput label="占用 U 数" type="number" min="1" value={form.item.u_height} onChange={(event) => setItemField('u_height', event.target.value)} />
              <FormInput label="功率需求(W)" type="number" min="0" value={form.item.power_watts} onChange={(event) => setItemField('power_watts', event.target.value)} />
              <FormInput label="所需 IP 数量" type="number" min="0" value={form.item.ip_quantity} onChange={(event) => setItemField('ip_quantity', event.target.value)} />
              <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">网络需求</label><select value={form.item.network_role} onChange={(event) => setItemField('network_role', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{NETWORK_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">IP 动作</label><select value={form.item.ip_action} onChange={(event) => setItemField('ip_action', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{IP_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.item.requires_static_ip} onChange={(event) => setItemField('requires_static_ip', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />需要固定 IP</label>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">源位置</div>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">源机房</label><select value={form.item.source_datacenter} onChange={(event) => setForm((prev) => ({ ...prev, item: { ...prev.item, source_datacenter: event.target.value, source_rack: '' } }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">请选择</option>{topology.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">源机柜</label><select value={form.item.source_rack} onChange={(event) => setItemField('source_rack', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">请选择</option>{(sourceDatacenter?.racks || []).map((item) => <option key={item.id} value={item.id}>{item.name || item.code}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><FormInput label="源起始 U 位" type="number" min="1" value={form.item.source_u_start} onChange={(event) => setItemField('source_u_start', event.target.value)} /><FormInput label="源结束 U 位" type="number" min="1" value={form.item.source_u_end} onChange={(event) => setItemField('source_u_end', event.target.value)} /></div>
                <RackHint rack={sourceRack} title="当前占用情况" />
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">目标位置</div>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">目标机房</label><select value={form.item.target_datacenter} onChange={(event) => setForm((prev) => ({ ...prev, item: { ...prev.item, target_datacenter: event.target.value, target_rack: '' } }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">请选择</option>{topology.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div className="mb-4"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">目标机柜</label><select value={form.item.target_rack} onChange={(event) => setItemField('target_rack', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">请选择</option>{(targetDatacenter?.racks || []).map((item) => <option key={item.id} value={item.id}>{item.name || item.code}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><FormInput label="目标起始 U 位" type="number" min="1" value={form.item.target_u_start} onChange={(event) => setItemField('target_u_start', event.target.value)} /><FormInput label="目标结束 U 位" type="number" min="1" value={form.item.target_u_end} onChange={(event) => setItemField('target_u_end', event.target.value)} /></div>
                <RackHint rack={targetRack} title="目标机柜占用情况" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">取消</button>
            <button onClick={submit} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300" type="button">{saving ? '提交中...' : '提交申请'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
