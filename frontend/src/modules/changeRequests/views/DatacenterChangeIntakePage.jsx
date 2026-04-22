import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, FileText, Loader2, Plus, Send, Trash2 } from 'lucide-react';

import { fetchCsrfToken, safeFetch } from '../../../lib/api';

const REQUEST_TYPES = {
  rack_in: '设备上架',
  rack_out: '设备下架',
  move_in: '设备搬入',
  move_out: '设备搬出',
  relocate: '位置迁移',
  decommission: '设备退网',
  assistance: '协助申请',
  power_change: '电力变更',
};

const REQUEST_TYPE_OPTIONS = [
  { value: 'assistance', label: '协助申请' },
];

const ASSISTANCE_TYPE_LABELS = {
  general_support: '综合协助',
  rack_in: '设备上架',
  rack_out: '设备下架',
  relocate: '设备迁移',
  firewall_port_open: '防火墙访问开通',
  ip_open: 'IP 开通',
  external_terminal_access: '外来终端接入厅内网络',
  other_support: '其他协助',
};

const ASSISTANCE_TYPE_OPTIONS = [
  { value: 'rack_in', label: '设备上架' },
  { value: 'rack_out', label: '设备下架' },
  { value: 'relocate', label: '设备迁移' },
  { value: 'firewall_port_open', label: '防火墙访问开通' },
  { value: 'ip_open', label: 'IP 开通' },
  { value: 'external_terminal_access', label: '外来终端接入厅内网络' },
  { value: 'other_support', label: '其他协助' },
];

const NETWORK_ROLE_LABELS = {
  none: '无需网络',
  command: '指挥网',
  government: '政务外网',
  other: '其他',
  management: '管理网',
  service: '业务网',
  dual: '双网',
};

const NETWORK_ROLE_OPTIONS = [
  { value: 'none', label: '无需网络' },
  { value: 'command', label: '指挥网' },
  { value: 'government', label: '政务外网' },
  { value: 'other', label: '其他' },
];

const IP_ACTION_OPTIONS = [
  { value: 'allocate', label: '新分配' },
  { value: 'keep', label: '保留原 IP' },
  { value: 'change', label: '调整 IP' },
  { value: 'release', label: '释放原 IP' },
  { value: 'none', label: '不涉及' },
];

const isAssistanceRequest = (requestType) => requestType === 'assistance';
const EQUIPMENT_ASSISTANCE_TYPES = new Set(['rack_in', 'rack_out', 'relocate']);
const isFirewallPortAssistance = (formLike) =>
  isAssistanceRequest(formLike?.request_type) && formLike?.assistance_type === 'firewall_port_open';
const isIpOpenAssistance = (formLike) =>
  isAssistanceRequest(formLike?.request_type) && formLike?.assistance_type === 'ip_open';
const isExternalTerminalAssistance = (formLike) =>
  isAssistanceRequest(formLike?.request_type) && formLike?.assistance_type === 'external_terminal_access';
const assistanceNeedsItems = (formLike) =>
  isAssistanceRequest(formLike?.request_type) && EQUIPMENT_ASSISTANCE_TYPES.has(formLike?.assistance_type);
const shouldUseItems = (formLike) => !isAssistanceRequest(formLike?.request_type) || assistanceNeedsItems(formLike);

const createEmptyFirewallRule = () => ({
  rule_type: 'destination',
  destination_ip: '',
  destination_port: '',
  purpose: '',
});

const FIREWALL_RULE_TYPE_OPTIONS = [
  { value: 'destination', label: '目标访问' },
  { value: 'snat', label: 'SNAT' },
];

const createEmptyAssistanceFields = () => ({
  destination_ip: '',
  destination_port: '',
  firewall_open_at: '',
  firewall_rules: [createEmptyFirewallRule()],
  ip_open_details: '',
  ip_open_at: '',
  access_location: '',
  access_at: '',
  antivirus_installed: false,
  terminal_mac: '',
  related_links: '',
});

const getAssistancePageTitle = (assistanceType) => {
  switch (assistanceType) {
    case 'rack_in':
      return '设备上架申请';
    case 'rack_out':
      return '设备下架申请';
    case 'relocate':
      return '设备迁移申请';
    case 'firewall_port_open':
      return '防火墙访问开通申请';
    case 'ip_open':
      return 'IP 开通申请';
    case 'external_terminal_access':
      return '外来终端接入厅内网络申请';
    case 'other_support':
      return '其他协助申请';
    default:
      return '协助申请';
  }
};

const REQUEST_FLOW_STEPS = ['填写资料', '生成表单号', '领导签批', '施工处理', '打印留档'];

const createEmptyItem = () => ({
  rack_device: '',
  device_name: '',
  device_model: '',
  serial_number: '',
  quantity: 1,
  u_height: 1,
  power_watts: 0,
  network_role: 'none',
  ip_quantity: 0,
  ip_action: 'allocate',
  assigned_management_ip: '',
  assigned_service_ip: '',
  source_datacenter: '',
  source_rack: '',
  source_rack_code: '',
  source_u_start: '',
  source_u_end: '',
  target_datacenter: '',
  target_rack: '',
  target_rack_code: '',
  target_u_start: '',
  target_u_end: '',
  notes: '',
});

const createEmptyForm = (requestType = 'assistance', assistanceType = 'other_support') => ({
  request_type: requestType,
  title: '',
  applicant_name: '',
  applicant_phone: '',
  applicant_email: '',
  company: '',
  department: '',
  project_name: '',
  assistance_type: assistanceType,
  reason: '',
  request_content: '',
  ...createEmptyAssistanceFields(),
  impact_scope: '',
  requires_power_down: false,
  planned_execute_at: '',
  items: shouldUseItems({ request_type: requestType, assistance_type: assistanceType }) ? [createEmptyItem()] : [],
});

const formatDateTime = (value) => {
  if (!value) return '未填写';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
};

const extractResponseMessage = async (response, fallback) => {
  try {
    const payload = await response.clone().json();
    if (typeof payload === 'string') return payload;
    return payload.detail || payload.message || payload.error || JSON.stringify(payload);
  } catch {
    try {
      const text = await response.text();
      if (!text) return fallback;
      if (text.includes('<!doctype') || text.includes('<html')) {
        return '接口返回了网页内容而不是 JSON，请检查后端服务是否已更新并重启。';
      }
      return text;
    } catch {
      return fallback;
    }
  }
};

const buildFormFromRequest = (requestData) => {
  const requestType = requestData?.request_type || 'assistance';
  const assistanceType = requestData?.assistance_type || 'other_support';
  const sourceItems = Array.isArray(requestData?.items) ? requestData.items : [];
  const items = sourceItems.length
    ? sourceItems.map((item) => ({
        device_name: item.device_name || '',
        device_model: item.device_model || '',
        serial_number: item.serial_number || '',
        quantity: item.quantity || 1,
        u_height: item.u_height || 1,
        power_watts: item.power_watts || 0,
        network_role: item.network_role || 'none',
        ip_quantity: item.ip_quantity || 0,
        ip_action: item.ip_action || 'allocate',
        assigned_management_ip: item.assigned_management_ip || '',
        assigned_service_ip: item.assigned_service_ip || '',
        rack_device: item.rack_device ? String(item.rack_device) : '',
        source_datacenter: item.source_datacenter ? String(item.source_datacenter) : '',
        source_rack: item.source_rack ? String(item.source_rack) : '',
        source_rack_code: item.source_rack_code || '',
        source_u_start: item.source_u_start || '',
        source_u_end: item.source_u_end || '',
        target_datacenter: item.target_datacenter ? String(item.target_datacenter) : '',
        target_rack: item.target_rack ? String(item.target_rack) : '',
        target_rack_code: item.target_rack_code || '',
        target_u_start: item.target_u_start || '',
        target_u_end: item.target_u_end || '',
        notes: item.notes || '',
      }))
    : shouldUseItems({ request_type: requestType, assistance_type: assistanceType })
      ? [createEmptyItem()]
      : [createEmptyItem()];
  const normalizedItems = shouldUseItems({ request_type: requestType, assistance_type: assistanceType }) ? items : [];
  const firewallRules = Array.isArray(requestData?.firewall_rules) && requestData.firewall_rules.length
    ? requestData.firewall_rules.map((rule) => ({
        rule_type: rule.rule_type || 'destination',
        destination_ip: rule.destination_ip || '',
        destination_port: rule.destination_port || '',
        purpose: rule.purpose || '',
      }))
    : requestData?.destination_ip || requestData?.destination_port
      ? [{
          rule_type: 'destination',
          destination_ip: requestData?.destination_ip || '',
          destination_port: requestData?.destination_port || '',
          purpose: requestData?.request_content || '',
        }]
      : [createEmptyFirewallRule()];

  return {
    request_type: requestType,
    title: requestData?.title || '',
    applicant_name: requestData?.applicant_name || '',
    applicant_phone: requestData?.applicant_phone || '',
    applicant_email: requestData?.applicant_email || '',
    company: requestData?.company || '',
    department: requestData?.department || '',
    project_name: requestData?.project_name || '',
    assistance_type: assistanceType,
    reason: requestData?.reason || '',
    request_content: requestData?.request_content || '',
    destination_ip: requestData?.destination_ip || '',
    destination_port: requestData?.destination_port || '',
    firewall_open_at: requestData?.firewall_open_at ? String(requestData.firewall_open_at).slice(0, 16) : '',
    firewall_rules: firewallRules,
    ip_open_details: requestData?.ip_open_details || '',
    ip_open_at: requestData?.ip_open_at ? String(requestData.ip_open_at).slice(0, 16) : '',
    access_location: requestData?.access_location || '',
    access_at: requestData?.access_at ? String(requestData.access_at).slice(0, 16) : '',
    antivirus_installed: !!requestData?.antivirus_installed,
    terminal_mac: requestData?.terminal_mac || '',
    related_links: requestData?.related_links || '',
    impact_scope: requestData?.impact_scope || '',
    requires_power_down: !!requestData?.requires_power_down,
    planned_execute_at: requestData?.planned_execute_at ? String(requestData.planned_execute_at).slice(0, 16) : '',
    items: normalizedItems,
  };
};

const ReadonlyField = ({ label, value }) => (
  <div>
    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
      {value || '未预填'}
    </div>
  </div>
);

export default function DatacenterChangeIntakePage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const token = params?.get('token') || '';
  const hasToken = !!token;
  const introStorageKey = hasToken ? `changeRequestIntroSeen:${token}` : '';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [entryData, setEntryData] = useState(null);
  const [requestData, setRequestData] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [topology, setTopology] = useState([]);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [showFlowIntro, setShowFlowIntro] = useState(false);

  const isPermanentEntry = !hasToken || !!entryData?.is_permanent;

  useEffect(() => {
    const loadRequest = async () => {
      if (!hasToken) {
        setEntryData({ public_link: '', is_permanent: false, requires_token: true });
        setRequestData(null);
        setForm(createEmptyForm());
        setTopology([]);
        setError('');
        setNotice('');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      setNotice('');
      try {
        await fetchCsrfToken();
        const endpoint = `/api/public/change-requests/${token}/`;
        const response = await safeFetch(endpoint);
        if (!response.ok) throw new Error(await extractResponseMessage(response, '加载申请信息失败。'));
        const payload = await response.json().catch(() => ({}));
        setEntryData(payload.entry || { public_link: '', is_permanent: false, requires_token: true });
        setRequestData(payload.request || null);
        setForm(buildFormFromRequest(payload.request || createEmptyForm()));
        setTopology(Array.isArray(payload.topology) ? payload.topology : []);
      } catch (requestError) {
        setError(requestError.message || '加载申请信息失败。');
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [hasToken, token]);

  useEffect(() => {
    if (!hasToken) {
      setShowFlowIntro(false);
      return;
    }
    if (typeof window === 'undefined') {
      setShowFlowIntro(true);
      return;
    }
    setShowFlowIntro(window.localStorage.getItem(introStorageKey) !== '1');
  }, [hasToken, introStorageKey]);

  const assistance = useMemo(() => isAssistanceRequest(form.request_type), [form.request_type]);
  const summaryLabel = REQUEST_TYPES[form.request_type] || form.request_type;
  const assistanceSubtypeLabel = ASSISTANCE_TYPE_LABELS[form.assistance_type] || form.assistance_type;
  const showItemEditor = shouldUseItems(form);
  const singleDatacenter = topology.length === 1 ? topology[0] : null;

  const handleContinueFromIntro = () => {
    if (typeof window !== 'undefined' && introStorageKey) {
      window.localStorage.setItem(introStorageKey, '1');
    }
    setShowFlowIntro(false);
  };

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'request_type') {
        const nextAssistanceType = value === 'assistance' ? prev.assistance_type || 'other_support' : prev.assistance_type;
        next.assistance_type = nextAssistanceType;
        next.items = shouldUseItems({ request_type: value, assistance_type: nextAssistanceType })
          ? prev.items?.length
            ? prev.items
            : [createEmptyItem()]
          : [];
        if (value !== 'assistance') {
          Object.assign(next, createEmptyAssistanceFields());
        }
      }
      if (key === 'assistance_type') {
        next.items = shouldUseItems({ request_type: next.request_type, assistance_type: value })
          ? prev.items?.length
            ? prev.items
            : [createEmptyItem()]
          : [];
        if (value !== 'firewall_port_open') {
          next.destination_ip = '';
          next.destination_port = '';
          next.firewall_open_at = '';
          next.firewall_rules = [createEmptyFirewallRule()];
        } else if (!prev.firewall_rules?.length) {
          next.firewall_rules = [createEmptyFirewallRule()];
        }
        if (value !== 'ip_open') {
          next.ip_open_details = '';
          next.ip_open_at = '';
        }
        if (value !== 'external_terminal_access') {
          next.access_location = '';
          next.access_at = '';
          next.antivirus_installed = false;
          next.terminal_mac = '';
        }
      }
      return next;
    });
  };

  const setItemField = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  };

  const updateFirewallRule = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      firewall_rules: (prev.firewall_rules?.length ? prev.firewall_rules : [createEmptyFirewallRule()]).map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule
      ),
    }));
  };

  const addFirewallRule = () => {
    setForm((prev) => ({
      ...prev,
      firewall_rules: [...(prev.firewall_rules?.length ? prev.firewall_rules : [createEmptyFirewallRule()]), createEmptyFirewallRule()],
    }));
  };

  const removeFirewallRule = (index) => {
    setForm((prev) => {
      const rules = prev.firewall_rules?.length ? prev.firewall_rules : [createEmptyFirewallRule()];
      return {
        ...prev,
        firewall_rules: rules.length === 1 ? [createEmptyFirewallRule()] : rules.filter((_, ruleIndex) => ruleIndex !== index),
      };
    });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length === 1 ? [createEmptyItem()] : prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetPublicForm = () => {
    setSubmittedRequest(null);
    setNotice('');
    setError('');
    const empty = createEmptyForm();
    setRequestData(null);
    setForm(empty);
  };

  const applyDevicePreset = (index, rackId, rackDeviceId) => {
    const sourceDatacenterId = singleDatacenter ? String(singleDatacenter.id) : form.items[index]?.source_datacenter;
    const sourceDatacenter = topology.find((dc) => String(dc.id) === String(sourceDatacenterId));
    const sourceRack = sourceDatacenter?.racks?.find((rack) => String(rack.id) === String(rackId));
    const device = sourceRack?.devices?.find((candidate) => String(candidate.id) === String(rackDeviceId));
    if (!device) return;

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              rack_device: String(device.id),
              device_name: device.name || item.device_name,
              device_model: device.model || device.device_type || item.device_model,
              serial_number: device.serial_number || item.serial_number,
              quantity: 1,
              u_height: device.u_height || item.u_height || 1,
              assigned_management_ip: item.assigned_management_ip || device.mgmt_ip || '',
              source_rack: String(rackId),
              source_rack_code: sourceRack?.code || sourceRack?.name || '',
              source_u_start: device.position || '',
              source_u_end: device.position && device.u_height ? device.position - device.u_height + 1 : '',
            }
          : item
      ),
    }));
  };

  const submit = async () => {
    if (!form.applicant_name?.trim()) {
      setError(assistance ? '请先填写需求联系人。' : '请先填写申请人。');
      return;
    }
    if (!form.applicant_phone?.trim()) {
      setError(assistance ? '请先填写联系方式。' : '请先填写联系电话。');
      return;
    }
    if (assistance && assistanceNeedsItems(form) && !form.items.length) {
      setError('请至少填写一台设备信息。');
      return;
    }
    if (assistance && assistanceNeedsItems(form)) {
      for (let index = 0; index < form.items.length; index += 1) {
        const item = form.items[index];
        if (form.assistance_type === 'rack_out') {
          if (!(item.source_datacenter || singleDatacenter?.id)) {
            setError(`请先为设备 ${index + 1} 选择下架机房。`);
            return;
          }
          if (!item.source_rack) {
            setError(`请先为设备 ${index + 1} 选择下架机柜。`);
            return;
          }
        }
        if (form.assistance_type !== 'rack_out') {
          if (!(item.target_datacenter || singleDatacenter?.id)) {
            setError(`请先为设备 ${index + 1} 选择上架机房。`);
            return;
          }
          if (!item.target_rack) {
            setError(`请先为设备 ${index + 1} 选择上架机柜。`);
            return;
          }
        }
      }
    }
    if (assistance && isFirewallPortAssistance(form)) {
      const firewallRules = (form.firewall_rules || []).filter(
        (rule) => rule.destination_ip?.trim() || rule.destination_port?.trim() || rule.purpose?.trim()
      );
      if (!firewallRules.length) {
        setError('请至少填写一条访问规则。');
        return;
      }
      for (let index = 0; index < firewallRules.length; index += 1) {
        const rule = firewallRules[index];
        if (!rule.rule_type || !rule.destination_ip?.trim() || !rule.destination_port?.trim() || !rule.purpose?.trim()) {
          setError(`请补全第 ${index + 1} 条访问规则的类型、地址、端口和用途说明。`);
          return;
        }
      }
      if (!form.firewall_open_at) {
        setError('请先填写访问规则开通时间。');
        return;
      }
    }
    if (assistance && isIpOpenAssistance(form)) {
      if (!form.ip_open_details?.trim()) {
        setError('请先填写 IP 开通说明。');
        return;
      }
      if (!form.ip_open_at) {
        setError('请先填写 IP 开通时间。');
        return;
      }
    }
    if (assistance && isExternalTerminalAssistance(form)) {
      if (!form.access_location?.trim()) {
        setError('请先填写接入位置。');
        return;
      }
      if (!form.access_at) {
        setError('请先填写接入时间。');
        return;
      }
      if (!form.terminal_mac?.trim()) {
        setError('请先填写终端 MAC 地址。');
        return;
      }
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const endpoint = token ? `/api/public/change-requests/${token}/` : '/api/public/change-requests/';
      const response = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await extractResponseMessage(response, '提交申请失败。'));
      const payload = await response.json().catch(() => ({}));
      const nextRequest = payload.request || null;
      setRequestData(nextRequest);
      setForm(buildFormFromRequest(nextRequest || form));
      if (Array.isArray(payload.topology)) {
        setTopology(payload.topology);
      }
      if (token) {
        setNotice('申请信息已提交，后续将进入审批流程。');
      } else {
        setSubmittedRequest(nextRequest);
      }
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
          正在加载申请中心...
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <div className="text-2xl font-black text-slate-900">申请入口不可用</div>
          <div className="mt-3 text-sm leading-6 text-rose-700">{error}</div>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="change-request-print-shell min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="mt-1 h-8 w-8 text-sky-600" />
              <div>
                <div className="text-3xl font-black tracking-tight text-slate-900">协助申请独立链接说明</div>
                <div className="mt-3 text-sm leading-6 text-slate-600">当前页面只作为说明入口使用。实际填写、查看进度和打印申请单，都需要通过管理员单独发送的时效链接进入。</div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-sky-200 bg-white/90 px-4 py-4 text-sm leading-6 text-slate-700">
              每一条申请都会生成自己的独立链接。A 默认看不到 B 的申请内容，B 也默认看不到 A 的申请内容；但谁拿到同一条完整链接，谁就能打开对应页面，所以请不要把链接转发给无关人员。
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-black text-slate-900">办理流程</div>
              <div className="mt-5 grid gap-3">
                {REQUEST_FLOW_STEPS.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">{index + 1}</div>
                    <div className="text-sm font-semibold text-slate-700">{step}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-black text-slate-900">你会看到什么</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">先看到申请说明和流程提醒，再进入对应的协助表单。</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">填写完成后系统会生成表单号，当前链接后续也可以继续查看并打印。</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">打印页已经预留领导签名位置，申请人在任何时间都可以下载留档。</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-6 text-amber-800 shadow-sm">
            请联系管理员获取你的专属申请链接后再填写。
          </div>
        </div>
      </div>
    );
  }

  if (submittedRequest && isPermanentEntry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex items-start gap-4">
            <ArrowLeftRight className="mt-1 h-9 w-9 text-emerald-600" />
            <div className="flex-1">
              <div className="text-3xl font-black text-slate-900">申请已提交</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                你的申请已经进入审批流程。现在可以直接下载申请单 PDF，或继续填写下一条申请。
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">表单号</div>
            <div className="mt-3 text-lg font-black leading-8 text-slate-900">{submittedRequest.request_code}</div>
            <div className="mt-2 text-xs text-slate-500">{REQUEST_TYPES[submittedRequest.request_type] || submittedRequest.request_type}{submittedRequest.request_type === 'assistance' ? ` / ${ASSISTANCE_TYPE_LABELS[submittedRequest.assistance_type] || '综合协助'}` : ''}</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {submittedRequest.public_export_url ? (
              <button
                onClick={() => window.open(submittedRequest.public_export_url, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                type="button"
              >
                <FileText className="h-4 w-4" />
                下载 PDF
              </button>
            ) : null}
            <button
              onClick={resetPublicForm}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
            >
              <Plus className="h-4 w-4" />
              继续提交下一条
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pageTitle = assistance ? getAssistancePageTitle(form.assistance_type) : '机房设备变更申请';
  const introText = isPermanentEntry
    ? '这是协助申请公开入口，申请方填写后即可生成表单号，并可随时打印带签字栏的申请单。'
    : '这是管理员发送的协助申请链接，申请方可在此继续完善资料、查看表单号并随时打印。';

  if (hasToken && showFlowIntro) {
    return (
      <div className="change-request-print-shell min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="mt-1 h-8 w-8 text-sky-600" />
              <div>
                <div className="text-3xl font-black tracking-tight text-slate-900">{pageTitle}</div>
                <div className="mt-3 text-sm leading-6 text-slate-600">这是一条专属于当前申请的独立时效链接。首次打开时，系统会先带你看完整的办理流程和注意事项，确认后再进入表单填写。</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-black text-slate-900">功能介绍</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">提交后系统会自动生成表单号，当前链接后续也可以继续查看并打印。</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">申请单中已预留领导签名位置，任何时间都可以下载打印留档。</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">A 和 B 默认不会互相看到对方申请，但拿到同一条完整链接的人都能打开该页面，所以请不要把链接转发给无关人员。</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">办理流程</div>
              <div className="mt-4 grid gap-3">
                {REQUEST_FLOW_STEPS.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">{index + 1}</div>
                    <div className="text-sm font-semibold text-slate-700">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm leading-6 text-slate-600">确认流程后再进入表单。进入后你仍然可以随时返回当前链接继续查看、补充和打印申请单。</div>
              <button
                onClick={handleContinueFromIntro}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                type="button"
              >
                <Send className="h-4 w-4" />
                下一步，填写申请
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="change-request-print-shell min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="mt-1 h-8 w-8 text-blue-600" />
              <div>
                <div className="text-3xl font-black tracking-tight text-slate-900">{pageTitle}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{introText}</div>
              </div>
            </div>
            <div className="flex gap-3">
              {requestData?.public_export_url ? (
                <button
                  onClick={() => window.open(requestData.public_export_url, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  type="button"
                >
                  <FileText className="h-4 w-4" />
                  下载 PDF
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-6 shadow-sm">
            <div className="text-sm font-bold text-sky-700">独立链接提醒</div>
            <div className="mt-3 text-base font-black text-slate-900">这是一条专属于当前申请的独立时效链接。</div>
            <div className="mt-3 text-sm leading-6 text-slate-600">当前链接提交后仍可继续查看和打印，对应的表单号和处理进度也会保留在这条链接下。默认情况下，A 和 B 不会互相看到对方的申请；但谁拿到同一条完整链接，谁就能打开这条申请，所以请勿转发给无关人员。</div>
            <div className="mt-4 rounded-2xl border border-sky-200 bg-white/90 px-4 py-4 text-sm leading-6 text-slate-700">
              提交后系统会自动生成表单号，当前链接后续也可以继续查看并打印，申请单中已预留领导签名位置。
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">办理流程</div>
            <div className="mt-4 grid gap-3">
              {REQUEST_FLOW_STEPS.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">{index + 1}</div>
                  <div className="text-sm font-semibold text-slate-700">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {requestData?.request_code ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">表单号 {requestData.request_code}</span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{summaryLabel}</span>
            {assistance ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{assistanceSubtypeLabel}</span> : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{`独立链接有效期：${formatDateTime(requestData?.token_expires_at)}`}</span>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-2xl font-black text-slate-900">申请信息</div>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadonlyField label="申请类型" value={summaryLabel} />
            <label className="text-sm text-slate-700">
              申请标题
              <input value={form.title} onChange={(event) => setField('title', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              {assistance ? '需求联系人' : '申请人'}
              <input value={form.applicant_name} onChange={(event) => setField('applicant_name', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              {assistance ? '联系方式' : '联系电话'}
              <input value={form.applicant_phone} onChange={(event) => setField('applicant_phone', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              联系邮箱
              <input value={form.applicant_email} onChange={(event) => setField('applicant_email', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              {assistance ? '申请单位' : '所属单位'}
              <input value={form.company} onChange={(event) => setField('company', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              {assistance ? '需求处室' : '所属部门'}
              <input value={form.department} onChange={(event) => setField('department', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              {assistance ? '项目名称' : '所属项目'}
              <input value={form.project_name} onChange={(event) => setField('project_name', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-700">
              {assistance ? '期望协助时间' : '计划执行时间'}
              <input type="datetime-local" value={form.planned_execute_at} onChange={(event) => setField('planned_execute_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
          </section>

          {assistance ? (
            <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700 md:col-span-2">
                协助分类
                <select value={form.assistance_type} onChange={(event) => setField('assistance_type', event.target.value)} className="mt-1 w-full rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-3 text-base font-semibold text-slate-800">
                  {ASSISTANCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-4 text-sm leading-6 text-slate-700 md:col-span-2">
                提交后系统会自动生成表单号，当前链接后续也可以继续查看并打印，申请单中已预留领导签名位置。
              </div>
              <label className="text-sm text-slate-700">
                协助申请缘由
                <textarea value={form.reason} onChange={(event) => setField('reason', event.target.value)} className="mt-1 h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              </label>
              <label className="text-sm text-slate-700">
                协助申请内容
                <textarea value={form.request_content} onChange={(event) => setField('request_content', event.target.value)} className="mt-1 h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              </label>
              {isFirewallPortAssistance(form) ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">访问规则</div>
                      <button onClick={addFirewallRule} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button">
                        <Plus className="h-4 w-4" />
                        增加规则
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(form.firewall_rules?.length ? form.firewall_rules : [createEmptyFirewallRule()]).map((rule, index) => (
                        <div key={`public-firewall-rule-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-bold text-slate-900">规则 {index + 1}</div>
                            {(form.firewall_rules?.length || 0) > 1 ? (
                              <button onClick={() => removeFirewallRule(index)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50" type="button">
                                <Trash2 className="h-3.5 w-3.5" />
                                删除
                              </button>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <label className="text-sm text-slate-700">
                              规则类型
                              <select value={rule.rule_type || 'destination'} onChange={(event) => updateFirewallRule(index, 'rule_type', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                                {FIREWALL_RULE_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-sm text-slate-700">
                              地址
                              <input value={rule.destination_ip} onChange={(event) => updateFirewallRule(index, 'destination_ip', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="例如：10.2.2.20" />
                            </label>
                            <label className="text-sm text-slate-700">
                              端口
                              <input value={rule.destination_port} onChange={(event) => updateFirewallRule(index, 'destination_port', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="例如：443" />
                            </label>
                            <label className="text-sm text-slate-700">
                              用途说明
                              <input value={rule.purpose} onChange={(event) => updateFirewallRule(index, 'purpose', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="例如：接口联调、业务访问、SNAT 转换" />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <label className="text-sm text-slate-700">
                    规则开通时间
                    <input type="datetime-local" value={form.firewall_open_at} onChange={(event) => setField('firewall_open_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                  </label>
                  <label className="text-sm text-slate-700">
                    相关链接
                    <textarea value={form.related_links} onChange={(event) => setField('related_links', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="填写系统链接、接口文档、工单链接等" />
                  </label>
                </>
              ) : null}
              {isIpOpenAssistance(form) ? (
                <>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    IP 开通说明
                    <textarea value={form.ip_open_details} onChange={(event) => setField('ip_open_details', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="填写接入网段、用途、使用系统和期望开通内容" />
                  </label>
                  <label className="text-sm text-slate-700">
                    IP 开通时间
                    <input type="datetime-local" value={form.ip_open_at} onChange={(event) => setField('ip_open_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                  </label>
                  <label className="text-sm text-slate-700">
                    相关链接
                    <textarea value={form.related_links} onChange={(event) => setField('related_links', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="填写工单链接、需求文档、系统地址等" />
                  </label>
                </>
              ) : null}
              {isExternalTerminalAssistance(form) ? (
                <>
                  <label className="text-sm text-slate-700">
                    接入位置
                    <input value={form.access_location} onChange={(event) => setField('access_location', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="例如：401 会议室、综合办公区" />
                  </label>
                  <label className="text-sm text-slate-700">
                    接入时间
                    <input type="datetime-local" value={form.access_at} onChange={(event) => setField('access_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                  </label>
                  <label className="text-sm text-slate-700">
                    终端 MAC 地址
                    <input value={form.terminal_mac} onChange={(event) => setField('terminal_mac', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="例如：782b-4645-c9a0" />
                  </label>
                  <label className="mt-7 flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={!!form.antivirus_installed} onChange={(event) => setField('antivirus_installed', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                    已完成杀毒
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    相关链接
                    <textarea value={form.related_links} onChange={(event) => setField('related_links', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="填写工单链接、审批链接或相关说明地址" />
                  </label>
                </>
              ) : null}
              {!isFirewallPortAssistance(form) && !isIpOpenAssistance(form) && !isExternalTerminalAssistance(form) ? (
                <label className="text-sm text-slate-700 md:col-span-2">
                  相关链接
                  <textarea value={form.related_links} onChange={(event) => setField('related_links', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="可填写需求文档、工单链接、系统地址等" />
                </label>
              ) : null}
              {showItemEditor ? (
                <div className="md:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900">设备清单</div>
                    {isPermanentEntry ? (
                      <button
                        onClick={addItem}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                        增加设备
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    {form.items.map((item, index) => (
                      <div key={`assistance-item-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-sm font-bold text-slate-900">设备 {index + 1}</div>
                          {isPermanentEntry && form.items.length > 1 ? (
                            <button
                              onClick={() => removeItem(index)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              type="button"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          ) : null}
                        </div>
                        {(() => {
                          const showSource = form.assistance_type === 'rack_out';
                          const showTarget = form.assistance_type !== 'rack_out';
                          const sourceDatacenterId = item.source_datacenter || (singleDatacenter ? String(singleDatacenter.id) : '');
                          const targetDatacenterId = item.target_datacenter || (singleDatacenter ? String(singleDatacenter.id) : '');
                          const sourceDatacenter = topology.find((dc) => String(dc.id) === String(sourceDatacenterId));
                          const targetDatacenter = topology.find((dc) => String(dc.id) === String(targetDatacenterId));
                          const sourceRack = sourceDatacenter?.racks?.find((rack) => String(rack.id) === String(item.source_rack));
                          const targetRack = targetDatacenter?.racks?.find((rack) => String(rack.id) === String(item.target_rack));

                          return (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {showSource && !singleDatacenter ? (
                            <label className="text-sm text-slate-700">
                              下架机房
                              <select value={item.source_datacenter} onChange={(event) => { setItemField(index, 'source_datacenter', event.target.value); setItemField(index, 'source_rack', ''); setItemField(index, 'rack_device', ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                                <option value="">请选择</option>
                                {topology.map((dc) => <option key={dc.id} value={dc.id}>{dc.name}</option>)}
                              </select>
                            </label>
                          ) : null}
                          {showSource ? (
                            <label className="text-sm text-slate-700">
                              下架机柜
                              <select value={item.source_rack} onChange={(event) => { setItemField(index, 'source_rack', event.target.value); setItemField(index, 'rack_device', ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                                <option value="">请选择</option>
                                {(sourceDatacenter?.racks || []).map((rack) => <option key={rack.id} value={rack.id}>{rack.name || rack.code}</option>)}
                              </select>
                            </label>
                          ) : null}
                          {showSource ? (
                            <label className="text-sm text-slate-700">
                              现有设备
                              <select value={item.rack_device} onChange={(event) => { setItemField(index, 'rack_device', event.target.value); applyDevicePreset(index, item.source_rack, event.target.value); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                                <option value="">可选</option>
                                {(sourceRack?.devices || []).map((device) => <option key={device.id} value={device.id}>{device.name}{device.mgmt_ip ? ` / ${device.mgmt_ip}` : ''}</option>)}
                              </select>
                            </label>
                          ) : null}
                          {showTarget && !singleDatacenter ? (
                            <label className="text-sm text-slate-700">
                              上架机房
                              <select value={item.target_datacenter} onChange={(event) => { setItemField(index, 'target_datacenter', event.target.value); setItemField(index, 'target_rack', ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                                <option value="">请选择</option>
                                {topology.map((dc) => <option key={dc.id} value={dc.id}>{dc.name}</option>)}
                              </select>
                            </label>
                          ) : null}
                          {showTarget ? (
                            <label className="text-sm text-slate-700">
                              上架机柜
                              <select value={item.target_rack} onChange={(event) => setItemField(index, 'target_rack', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                                <option value="">请选择</option>
                                {(targetDatacenter?.racks || []).map((rack) => <option key={rack.id} value={rack.id}>{rack.name || rack.code}</option>)}
                              </select>
                            </label>
                          ) : null}
                          <label className="text-sm text-slate-700">
                            设备名称
                            <input value={item.device_name} onChange={(event) => setItemField(index, 'device_name', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            设备型号
                            <input value={item.device_model} onChange={(event) => setItemField(index, 'device_model', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            序列号
                            <input value={item.serial_number} onChange={(event) => setItemField(index, 'serial_number', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            数量
                            <input type="number" min="1" value={item.quantity} onChange={(event) => setItemField(index, 'quantity', Number(event.target.value || 1))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            占用 U 数
                            <input type="number" min="1" value={item.u_height} onChange={(event) => setItemField(index, 'u_height', Number(event.target.value || 1))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            网络类型
                            <select value={item.network_role} onChange={(event) => setItemField(index, 'network_role', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                              {NETWORK_ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-700">
                            IP 处理
                            <select value={item.ip_action} onChange={(event) => setItemField(index, 'ip_action', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                              {IP_ACTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-700">
                            管理 IP
                            <input value={item.assigned_management_ip} onChange={(event) => setItemField(index, 'assigned_management_ip', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            业务 IP
                            <input value={item.assigned_service_ip} onChange={(event) => setItemField(index, 'assigned_service_ip', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700 md:col-span-2 xl:col-span-3">
                            备注
                            <textarea value={item.notes} onChange={(event) => setItemField(index, 'notes', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                        </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  申请原因
                  <textarea value={form.reason} onChange={(event) => setField('reason', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="text-sm text-slate-700">
                  影响范围
                  <textarea value={form.impact_scope} onChange={(event) => setField('impact_scope', event.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                </label>
              </div>

              <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={!!form.requires_power_down} onChange={(event) => setField('requires_power_down', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                本次申请涉及停电窗口
              </label>

              <section className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black text-slate-900">设备明细</div>
                  {isPermanentEntry ? (
                    <button
                      onClick={addItem}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      新增设备
                    </button>
                  ) : null}
                </div>

                {form.items.map((item, index) => (
                  <div key={`public-item-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">设备 {index + 1}</div>
                      {isPermanentEntry && form.items.length > 1 ? (
                        <button
                          onClick={() => removeItem(index)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </button>
                      ) : null}
                    </div>

                    {isPermanentEntry ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="text-sm text-slate-700">
                            设备名称
                            <input value={item.device_name} onChange={(event) => setItemField(index, 'device_name', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            设备型号
                            <input value={item.device_model} onChange={(event) => setItemField(index, 'device_model', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            序列号
                            <input value={item.serial_number} onChange={(event) => setItemField(index, 'serial_number', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            数量
                            <input type="number" min="1" value={item.quantity} onChange={(event) => setItemField(index, 'quantity', Number(event.target.value || 1))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            占用 U 数
                            <input type="number" min="1" value={item.u_height} onChange={(event) => setItemField(index, 'u_height', Number(event.target.value || 1))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            功率需求(W)
                            <input type="number" min="0" value={item.power_watts} onChange={(event) => setItemField(index, 'power_watts', Number(event.target.value || 0))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            网络需求
                            <select value={item.network_role} onChange={(event) => setItemField(index, 'network_role', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                              {NETWORK_ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-700">
                            IP 动作
                            <select value={item.ip_action} onChange={(event) => setItemField(index, 'ip_action', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                              {IP_ACTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-700">
                            IP 数量
                            <input type="number" min="0" value={item.ip_quantity} onChange={(event) => setItemField(index, 'ip_quantity', Number(event.target.value || 0))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            管理 IP
                            <input value={item.assigned_management_ip} onChange={(event) => setItemField(index, 'assigned_management_ip', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            业务 IP
                            <input value={item.assigned_service_ip} onChange={(event) => setItemField(index, 'assigned_service_ip', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                        </div>
                        <div className="mt-4">
                          <label className="text-sm text-slate-700">
                            补充说明
                            <textarea value={item.notes} onChange={(event) => setItemField(index, 'notes', event.target.value)} className="mt-1 h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="text-sm text-slate-700">
                            设备名称
                            <input value={item.device_name} onChange={(event) => setItemField(index, 'device_name', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            设备型号
                            <input value={item.device_model} onChange={(event) => setItemField(index, 'device_model', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm text-slate-700">
                            序列号
                            <input value={item.serial_number} onChange={(event) => setItemField(index, 'serial_number', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
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
                          <label className="text-sm text-slate-700">
                            补充备注
                            <textarea value={item.notes} onChange={(event) => setItemField(index, 'notes', event.target.value)} className="mt-1 h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>
            </>
          )}

          <div className="mt-8 flex justify-end gap-3">
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
      </div>
    </div>
  );
}
