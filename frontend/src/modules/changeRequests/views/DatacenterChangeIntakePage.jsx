import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, FileText, Loader2, Send } from 'lucide-react';

import { fetchCsrfToken, safeFetch } from '../../../lib/api';

const REQUEST_TYPES = {
  rack_in: '设备上架',
  rack_out: '设备下架',
  move_in: '设备搬入',
  move_out: '设备搬出',
  relocate: '位置迁移',
  decommission: '设备退役',
  power_change: '电力变更',
};

const NETWORK_ROLE_LABELS = {
  none: '无需网络',
  command: '指挥网',
  government: '政务外网',
  other: '其他',
  management: '指挥网',
  service: '政务外网',
  dual: '双网',
};

const formatDateTime = (value) => {
  if (!value) return '未填写';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
};

const ReadonlyField = ({ label, value }) => (
  <div>
    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{value || '未预填'}</div>
  </div>
);

export default function DatacenterChangeIntakePage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const token = params?.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestData, setRequestData] = useState(null);
  const [form, setForm] = useState(null);

  const loadRequest = async () => {
    if (!token) {
      setError('缺少申请链接令牌。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await fetchCsrfToken();
      const response = await safeFetch(`/api/public/change-requests/${token}/`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.message || '加载申请信息失败。');
      setRequestData(payload.request);
      setForm({
        title: payload.request.title || '',
        applicant_name: payload.request.applicant_name || '',
        applicant_phone: payload.request.applicant_phone || '',
        applicant_email: payload.request.applicant_email || '',
        company: payload.request.company || '',
        department: payload.request.department || '',
        project_name: payload.request.project_name || '',
        reason: payload.request.reason || '',
        impact_scope: payload.request.impact_scope || '',
        requires_power_down: !!payload.request.requires_power_down,
        planned_execute_at: payload.request.planned_execute_at ? String(payload.request.planned_execute_at).slice(0, 16) : '',
        items: (payload.request.items || []).map((item) => ({
          device_name: item.device_name || '',
          device_model: item.device_model || '',
          serial_number: item.serial_number || '',
          quantity: item.quantity || 1,
          u_height: item.u_height || 1,
          power_watts: item.power_watts || 0,
          network_role: item.network_role || 'none',
          ip_quantity: item.ip_quantity || 0,
          assigned_management_ip: item.assigned_management_ip || '',
          assigned_service_ip: item.assigned_service_ip || '',
          source_rack_code: item.source_rack_code || '',
          source_u_start: item.source_u_start || '',
          source_u_end: item.source_u_end || '',
          target_rack_code: item.target_rack_code || '',
          target_u_start: item.target_u_start || '',
          target_u_end: item.target_u_end || '',
          notes: item.notes || '',
        })),
      });
    } catch (requestError) {
      setError(requestError.message || '加载申请信息失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequest(); }, [token]);

  const summary = useMemo(() => {
    if (!requestData) return null;
    return {
      requestType: REQUEST_TYPES[requestData.request_type] || requestData.request_type,
      itemCount: requestData.items?.length || 0,
    };
  }, [requestData]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setItemField = (index, key, value) => setForm((prev) => ({ ...prev, items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));

  const submit = async () => {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await safeFetch(`/api/public/change-requests/${token}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.message || '提交申请失败。');
      setNotice('申请信息已提交，后续将进入审批流程。');
      setRequestData(payload.request);
    } catch (requestError) {
      setError(requestError.message || '提交申请失败。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在加载设备变更申请...
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <div className="text-2xl font-black text-slate-900">链接无法使用</div>
          <div className="mt-3 text-sm leading-6 text-rose-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="change-request-print-shell min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="print:hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="mt-1 h-8 w-8 text-blue-600" />
              <div>
                <div className="text-3xl font-black tracking-tight text-slate-900">机房设备变更申请</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">这是管理员预先生成的独立链接。你只需要补充申请人、原因和设备备注等信息，不需要再手动选择机柜、U 位或 IP。</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.open(`/api/public/change-requests/${token}/export-pdf/`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
                <FileText className="h-4 w-4" />
                下载 PDF
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
                <FileText className="h-4 w-4" />
                打印申请单
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{requestData.request_code}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{summary?.requestType}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">设备 {summary?.itemCount || 0} 台</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">链接有效期：{formatDateTime(requestData.token_expires_at)}</span>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-2xl font-black text-slate-900">机房设备变更申请单</div>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">申请标题<input value={form.title} onChange={(e) => setField('title', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">申请人<input value={form.applicant_name} onChange={(e) => setField('applicant_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">联系电话<input value={form.applicant_phone} onChange={(e) => setField('applicant_phone', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">联系邮箱<input value={form.applicant_email} onChange={(e) => setField('applicant_email', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">所属单位<input value={form.company} onChange={(e) => setField('company', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">所属部门<input value={form.department} onChange={(e) => setField('department', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">所属项目<input value={form.project_name} onChange={(e) => setField('project_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">计划执行时间<input type="datetime-local" value={form.planned_execute_at} onChange={(e) => setField('planned_execute_at', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          </section>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">申请原因<textarea value={form.reason} onChange={(e) => setField('reason', e.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">影响范围<textarea value={form.impact_scope} onChange={(e) => setField('impact_scope', e.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!form.requires_power_down} onChange={(e) => setField('requires_power_down', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
            本次申请涉及下电窗口
          </label>

          <section className="mt-8 space-y-4">
            <div className="text-lg font-black text-slate-900">设备明细</div>
            {form.items.map((item, index) => (
              <div key={`public-item-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="mb-4 text-sm font-bold text-slate-900">设备 {index + 1}</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="text-sm text-slate-700">设备名称<input value={item.device_name} onChange={(e) => setItemField(index, 'device_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">设备型号<input value={item.device_model} onChange={(e) => setItemField(index, 'device_model', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">序列号<input value={item.serial_number} onChange={(e) => setItemField(index, 'serial_number', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <ReadonlyField label="数量" value={`${item.quantity} 台`} />
                  <ReadonlyField label="占用 U 数" value={`${item.u_height}U`} />
                  <ReadonlyField label="功率需求" value={`${item.power_watts}W`} />
                  <ReadonlyField label="网络需求" value={NETWORK_ROLE_LABELS[item.network_role] || item.network_role} />
                  <ReadonlyField label="IP 数量" value={item.ip_quantity} />
                  <ReadonlyField label="预分配管理 IP" value={item.assigned_management_ip} />
                  <ReadonlyField label="预分配业务 IP" value={item.assigned_service_ip} />
                  <ReadonlyField label="源机柜 / U 位" value={item.source_rack_code ? `${item.source_rack_code} / ${item.source_u_start || '-'}-${item.source_u_end || '-'}` : ''} />
                  <ReadonlyField label="目标机柜 / U 位" value={item.target_rack_code ? `${item.target_rack_code} / ${item.target_u_start || '-'}-${item.target_u_end || '-'}` : ''} />
                </div>
                <div className="mt-4">
                  <label className="text-sm text-slate-700">补充备注<textarea value={item.notes} onChange={(e) => setItemField(index, 'notes', e.target.value)} className="mt-1 h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                </div>
              </div>
            ))}
          </section>

          <div className="mt-8 flex justify-end gap-3 print:hidden">
            <button onClick={() => window.open(`/api/public/change-requests/${token}/export-pdf/`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
              <FileText className="h-4 w-4" />
              下载 PDF
            </button>
            <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300" type="button">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? '提交中...' : '提交申请'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
