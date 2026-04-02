import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ClipboardCheck, Loader2, Send } from 'lucide-react';

import { fetchCsrfToken, safeFetch } from '../lib/api';

const REQUEST_TYPES = {
  rack_in: '设备上架',
  rack_out: '设备下架',
  move_in: '设备搬入',
  move_out: '设备搬出',
  relocate: '位置迁移',
  decommission: '设备退役',
  power_change: '电力变更',
};

const NETWORK_ROLES = {
  none: '无需网络',
  management: '管理网络',
  service: '业务网络',
  dual: '双网',
};

function Field({ label, value, onChange, required = false, type = 'text' }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

export default function DatacenterChangeIntakePage() {
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token') || ''
      : '';
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
      if (!response.ok) throw new Error(payload.detail || payload.message || '加载申请失败');
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
          requires_static_ip: !!item.requires_static_ip,
          ip_action: item.ip_action || 'allocate',
          source_datacenter: item.source_datacenter || '',
          source_rack: item.source_rack || '',
          source_u_start: item.source_u_start || '',
          source_u_end: item.source_u_end || '',
          target_datacenter: item.target_datacenter || '',
          target_rack: item.target_rack || '',
          target_u_start: item.target_u_start || '',
          target_u_end: item.target_u_end || '',
          notes: item.notes || '',
        })),
      });
    } catch (err) {
      setError(err.message || '加载申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
  }, [token]);

  const summary = useMemo(() => {
    if (!requestData) return null;
    return {
      requestType: REQUEST_TYPES[requestData.request_type] || requestData.request_type,
      itemCount: requestData.items?.length || 0,
    };
  }, [requestData]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setItemField = (index, key, value) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));

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
      if (!response.ok) throw new Error(payload.detail || payload.message || '提交申请失败');
      setNotice('申请信息已提交，后续可由审批人继续处理。');
      setRequestData(payload.request);
    } catch (err) {
      setError(err.message || '提交申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在加载机房设备变更申请...
        </div>
      </div>
    );
  }

  if (error && !form) {
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
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <ArrowLeftRight className="mt-1 h-8 w-8 text-blue-600" />
            <div>
              <div className="text-3xl font-black tracking-tight text-slate-900">机房设备变更申请</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                这是一张独立申请链接，你可以补充申请人信息、设备需求和位置信息。提交后会进入审批/执行流程。
              </div>
            </div>
          </div>
        </div>

        {requestData ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{requestData.request_code}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{summary?.requestType}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">设备 {summary?.itemCount || 0} 项</span>
            </div>
            {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
          </div>
        ) : null}

        {form ? (
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="申请标题" value={form.title} onChange={(value) => setField('title', value)} required />
              <Field label="申请人" value={form.applicant_name} onChange={(value) => setField('applicant_name', value)} required />
              <Field label="联系电话" value={form.applicant_phone} onChange={(value) => setField('applicant_phone', value)} required />
              <Field label="联系邮箱" value={form.applicant_email} onChange={(value) => setField('applicant_email', value)} type="email" />
              <Field label="所属单位" value={form.company} onChange={(value) => setField('company', value)} />
              <Field label="所属部门" value={form.department} onChange={(value) => setField('department', value)} />
              <Field label="所属项目" value={form.project_name} onChange={(value) => setField('project_name', value)} />
              <Field label="计划执行时间" value={form.planned_execute_at} onChange={(value) => setField('planned_execute_at', value)} type="datetime-local" />
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">申请原因</label>
                <textarea
                  value={form.reason}
                  onChange={(event) => setField('reason', event.target.value)}
                  className="h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">影响范围</label>
                <textarea
                  value={form.impact_scope}
                  onChange={(event) => setField('impact_scope', event.target.value)}
                  className="h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </section>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!form.requires_power_down}
                onChange={(event) => setField('requires_power_down', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              该申请涉及下电窗口
            </label>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">设备明细</h2>
              </div>
              {form.items.map((item, index) => (
                <div key={index} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="设备名称" value={item.device_name} onChange={(value) => setItemField(index, 'device_name', value)} required />
                    <Field label="设备型号" value={item.device_model} onChange={(value) => setItemField(index, 'device_model', value)} />
                    <Field label="序列号" value={item.serial_number} onChange={(value) => setItemField(index, 'serial_number', value)} />
                    <Field label="数量" value={item.quantity} onChange={(value) => setItemField(index, 'quantity', value)} type="number" />
                    <Field label="占用 U 数" value={item.u_height} onChange={(value) => setItemField(index, 'u_height', value)} type="number" />
                    <Field label="功率需求(W)" value={item.power_watts} onChange={(value) => setItemField(index, 'power_watts', value)} type="number" />
                    <Field label="所需 IP 数量" value={item.ip_quantity} onChange={(value) => setItemField(index, 'ip_quantity', value)} type="number" />
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">网络需求</label>
                      <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700">{NETWORK_ROLES[item.network_role] || item.network_role}</div>
                    </div>
                    <Field label="源起始 U 位" value={item.source_u_start} onChange={(value) => setItemField(index, 'source_u_start', value)} type="number" />
                    <Field label="源结束 U 位" value={item.source_u_end} onChange={(value) => setItemField(index, 'source_u_end', value)} type="number" />
                    <Field label="目标起始 U 位" value={item.target_u_start} onChange={(value) => setItemField(index, 'target_u_start', value)} type="number" />
                    <Field label="目标结束 U 位" value={item.target_u_end} onChange={(value) => setItemField(index, 'target_u_end', value)} type="number" />
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!item.requires_static_ip}
                      onChange={(event) => setItemField(index, 'requires_static_ip', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                    />
                    需要固定 IP
                  </label>
                </div>
              ))}
            </section>

            <div className="flex justify-end">
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                type="button"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
