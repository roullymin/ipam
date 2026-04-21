import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Link2Off,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';

import ListToolbar from '../../../components/common/ListToolbar';
import { Modal } from '../../../components/common/UI';
import { safeFetch } from '../../../lib/api';

const REQUEST_TYPES = [
  ['rack_in', '设备上架'],
  ['rack_out', '设备下架'],
  ['move_in', '设备搬入'],
  ['move_out', '设备搬出'],
  ['relocate', '位置迁移'],
  ['decommission', '设备退役'],
  ['power_change', '电力变更'],
  ['assistance', '协助事项申请'],
];

const REQUEST_TYPE_LABELS = Object.fromEntries(REQUEST_TYPES);

const NETWORK_ROLES = [
  ['none', '无需网络'],
  ['command', '指挥网'],
  ['government', '政务外网'],
  ['other', '其他'],
];

const IP_ACTIONS = [
  ['allocate', '新分配'],
  ['keep', '保留原 IP'],
  ['change', '调整 IP'],
  ['release', '释放原 IP'],
  ['none', '不涉及'],
];

const STATUS_LABELS = {
  draft: '草稿',
  submitted: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  scheduled: '待执行',
  completed: '已完成',
  cancelled: '已取消',
};

const OUTBOUND_TYPES = new Set(['rack_out', 'move_out', 'relocate', 'decommission', 'power_change']);
const TARGET_TYPES = new Set(['rack_in', 'move_in', 'relocate']);

const createItem = (datacenterId = '') => ({
  id: '',
  rack_device: '',
  device_name: '',
  device_model: '',
  serial_number: '',
  quantity: 1,
  u_height: 1,
  power_watts: 0,
  network_role: 'none',
  ip_action: 'allocate',
  assigned_management_ip: '',
  assigned_service_ip: '',
  source_datacenter: datacenterId,
  source_rack: '',
  source_u_start: '',
  source_u_end: '',
  target_datacenter: datacenterId,
  target_rack: '',
  target_u_start: '',
  target_u_end: '',
  notes: '',
});

const createForm = (datacenterId = '') => ({
  request_type: 'rack_in',
  title: '',
  applicant_name: '',
  applicant_phone: '',
  applicant_email: '',
  company: '',
  department: '',
  project_name: '',
  reason: '',
  request_content: '',
  impact_scope: '',
  requires_power_down: false,
  planned_execute_at: '',
  items: [createItem(datacenterId)],
});

const createExecutionForm = (request) => ({
  executor_name: '',
  execution_comment: '',
  items: (request.items || []).map((item) => ({
    id: item.id,
    device_name: item.device_name || '',
    assigned_management_ip: item.assigned_management_ip || '',
    assigned_service_ip: item.assigned_service_ip || '',
    source_rack: item.source_rack || '',
    source_u_start: item.source_u_start || '',
    source_u_end: item.source_u_end || '',
    target_rack: item.target_rack || '',
    target_u_start: item.target_u_start || '',
    target_u_end: item.target_u_end || '',
    power_watts: item.power_watts || 0,
    notes: item.notes || '',
  })),
});

const cleanText = (value) => String(value ?? '').trim();
const isAssistanceRequest = (requestType) => requestType === 'assistance';

const formatDateTime = (value) => {
  if (!value) return '未设置';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('zh-CN', { hour12: false });
};

const normalizeNumeric = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (payload.detail) return payload.detail;
  if (payload.message) return payload.message;

  const messages = [];
  Object.entries(payload).forEach(([field, value]) => {
    if (Array.isArray(value)) {
      messages.push(`${field}: ${value.join('；')}`);
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([nestedField, nestedValue]) => {
        if (Array.isArray(nestedValue)) {
          messages.push(`${field}.${nestedField}: ${nestedValue.join('；')}`);
        } else {
          messages.push(`${field}.${nestedField}: ${JSON.stringify(nestedValue)}`);
        }
      });
    } else {
      messages.push(`${field}: ${value}`);
    }
  });

  return messages.join(' | ') || fallback;
};

const extractResponseMessage = async (response, fallback) => {
  try {
    const payload = await response.clone().json();
    return formatApiError(payload, fallback);
  } catch {
    try {
      const text = await response.text();
      if (!text) return fallback;
      if (text.includes('<!doctype') || text.includes('<html')) {
        return '接口返回了网页内容而不是 JSON，请检查后端服务是否已更新、已重启，并已执行数据库迁移。';
      }
      return text;
    } catch {
      return fallback;
    }
  }
};

const isLinkActive = (request) => request?.token_expires_at && new Date(request.token_expires_at).getTime() > Date.now();

const findRack = (topology, datacenterId, rackId) =>
  topology.find((dc) => String(dc.id) === String(datacenterId))?.racks?.find((rack) => String(rack.id) === String(rackId));

const unwrapListPayload = (payload) => (Array.isArray(payload) ? payload : payload?.results || []);

const buildFallbackTopology = (datacentersPayload, racksPayload, devicesPayload) => {
  const datacenters = unwrapListPayload(datacentersPayload);
  const racks = unwrapListPayload(racksPayload);
  const devices = unwrapListPayload(devicesPayload);

  return datacenters.map((datacenter) => {
    const datacenterRacks = racks
      .filter((rack) => String(rack.datacenter) === String(datacenter.id))
      .map((rack) => {
        const rackDevices = devices.filter((device) => String(device.rack) === String(rack.id));
        return {
          id: rack.id,
          code: rack.code,
          name: rack.name,
          height: rack.height,
          devices: rackDevices.map((device) => ({
            id: device.id,
            name: device.name,
            position: device.position,
            u_height: device.u_height,
            device_type: device.device_type,
            brand: device.brand,
            model: device.model || '',
            mgmt_ip: device.mgmt_ip,
            project: device.project,
            contact: device.contact,
            power_usage: device.power_usage,
            serial_number: device.sn || device.serial_number || '',
            asset_tag: device.asset_tag || '',
          })),
          occupied_ranges: rackDevices.map((device) => ({
            id: device.id,
            name: device.name,
            start: device.position,
            end: Math.max(1, Number(device.position || 1) - Math.max(Number(device.u_height || 1), 1) + 1),
          })),
        };
      });

    return {
      id: datacenter.id,
      name: datacenter.name,
      location: datacenter.location,
      racks: datacenterRacks,
    };
  });
};

export default function DatacenterChangeRequestView({ initialRequestId, onConsumeInitialRequestId }) {
  const [requests, setRequests] = useState([]);
  const [topology, setTopology] = useState([]);
  const [open, setOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [draftError, setDraftError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({ query: '', status: '' });
  const [form, setForm] = useState(createForm(''));
  const [executionTarget, setExecutionTarget] = useState(null);
  const [executionForm, setExecutionForm] = useState({ executor_name: '', execution_comment: '', items: [] });
  const [focusedRequestId, setFocusedRequestId] = useState(null);
  const focusedRowRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, topologyRes] = await Promise.all([
        safeFetch('/api/datacenter-change-requests/'),
        safeFetch('/api/datacenter-change-requests/topology/'),
      ]);
      if (!listRes.ok) throw new Error(await extractResponseMessage(listRes, '加载申请列表失败。'));
      const listData = await listRes.json().catch(() => []);
      let topologyRows = [];

      if (topologyRes.ok) {
        const topologyData = await topologyRes.json().catch(() => ({}));
        topologyRows = topologyData.datacenters || [];
      }

      if (!topologyRows.length) {
        const [datacentersRes, racksRes, devicesRes] = await Promise.all([
          safeFetch('/api/datacenters/'),
          safeFetch('/api/racks/'),
          safeFetch('/api/rack-devices/'),
        ]);
        if (datacentersRes.ok && racksRes.ok && devicesRes.ok) {
          const [datacentersData, racksData, devicesData] = await Promise.all([
            datacentersRes.json().catch(() => []),
            racksRes.json().catch(() => []),
            devicesRes.json().catch(() => []),
          ]);
          topologyRows = buildFallbackTopology(datacentersData, racksData, devicesData);
        } else if (!topologyRes.ok) {
          throw new Error(await extractResponseMessage(topologyRes, '加载机房拓扑失败。'));
        }
      }

      setRequests(Array.isArray(listData) ? listData : listData?.results || []);
      setTopology(topologyRows);
    } catch (requestError) {
      setError(requestError.message || '加载申请列表失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!initialRequestId?.id) return;
    setFocusedRequestId(String(initialRequestId.id));
    onConsumeInitialRequestId?.();
  }, [initialRequestId, onConsumeInitialRequestId]);

  useEffect(() => {
    if (!focusedRequestId || !focusedRowRef.current) return;
    focusedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedRequestId, requests]);

  const singleDatacenter = topology.length === 1 ? topology[0] : null;

  useEffect(() => {
    if (!singleDatacenter) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        source_datacenter: item.source_datacenter || String(singleDatacenter.id),
        target_datacenter: item.target_datacenter || String(singleDatacenter.id),
      })),
    }));
  }, [singleDatacenter]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      draft: requests.filter((item) => item.status === 'draft').length,
      submitted: requests.filter((item) => item.status === 'submitted').length,
      completed: requests.filter((item) => item.status === 'completed').length,
    }),
    [requests]
  );

  const displayRequests = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLowerCase();
    const filtered = requests.filter((request) => {
      if (filters.status && request.status !== filters.status) return false;
      if (!normalizedQuery) return true;

      const firstItem = request.items?.[0];
      const haystack = [
        request.request_code,
        request.title,
        request.applicant_name,
        request.applicant_phone,
        request.company,
        request.department,
        request.project_name,
        request.reason,
        request.request_content,
        STATUS_LABELS[request.status],
        REQUEST_TYPE_LABELS[request.request_type],
        firstItem?.device_name,
        firstItem?.device_model,
        firstItem?.serial_number,
        firstItem?.assigned_management_ip,
        firstItem?.assigned_service_ip,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    if (!focusedRequestId) return filtered;
    return [...filtered].sort((left, right) => {
      const leftFocused = String(left.id) === String(focusedRequestId);
      const rightFocused = String(right.id) === String(focusedRequestId);
      if (leftFocused === rightFocused) return 0;
      return leftFocused ? -1 : 1;
    });
  }, [filters, focusedRequestId, requests]);

  const updateField = (key, value) => {
    setDraftError('');
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const updateItem = (index, key, value) => {
    setDraftError('');
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  };
  const addItem = () =>
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, createItem(singleDatacenter ? String(singleDatacenter.id) : '')],
    }));
  const removeItem = (index) =>
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }));
  const resetForm = () => setForm(createForm(singleDatacenter ? String(singleDatacenter.id) : ''));

  const updateExecutionField = (key, value) => setExecutionForm((prev) => ({ ...prev, [key]: value }));
  const updateExecutionItem = (index, key, value) =>
    setExecutionForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));

  const applyDevicePreset = (index, rackId, rackDeviceId) => {
    const datacenterId = singleDatacenter ? String(singleDatacenter.id) : form.items[index]?.source_datacenter;
    const rack = findRack(topology, datacenterId, rackId);
    const device = rack?.devices?.find((candidate) => String(candidate.id) === String(rackDeviceId));
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
              power_watts: device.power_usage || item.power_watts || 0,
              assigned_management_ip: item.assigned_management_ip || device.mgmt_ip || '',
              source_rack: String(rackId),
              source_u_start: device.position || '',
              source_u_end: device.position && device.u_height ? device.position - device.u_height + 1 : '',
            }
          : item
      ),
    }));
  };

  const normalizeItem = (item) => ({
    ...item,
    device_name: cleanText(item.device_name),
    device_model: cleanText(item.device_model),
    serial_number: cleanText(item.serial_number),
    assigned_management_ip: cleanText(item.assigned_management_ip),
    assigned_service_ip: cleanText(item.assigned_service_ip),
    notes: cleanText(item.notes),
    quantity: Number(item.quantity || 1),
    u_height: Number(item.u_height || 1),
    power_watts: Number(item.power_watts || 0),
    source_datacenter: item.source_datacenter || (singleDatacenter ? singleDatacenter.id : null),
    target_datacenter: item.target_datacenter || (singleDatacenter ? singleDatacenter.id : null),
    source_rack: item.source_rack || null,
    target_rack: item.target_rack || null,
    source_u_start: normalizeNumeric(item.source_u_start),
    source_u_end: normalizeNumeric(item.source_u_end),
    target_u_start: normalizeNumeric(item.target_u_start),
    target_u_end: normalizeNumeric(item.target_u_end),
  });

  const normalizeExecutionItem = (item) => ({
    id: item.id,
    device_name: cleanText(item.device_name),
    assigned_management_ip: cleanText(item.assigned_management_ip),
    assigned_service_ip: cleanText(item.assigned_service_ip),
    source_rack: item.source_rack || null,
    source_u_start: normalizeNumeric(item.source_u_start),
    source_u_end: normalizeNumeric(item.source_u_end),
    target_rack: item.target_rack || null,
    target_u_start: normalizeNumeric(item.target_u_start),
    target_u_end: normalizeNumeric(item.target_u_end),
    power_watts: Number(item.power_watts || 0),
    notes: cleanText(item.notes),
  });

  const validateDraft = () => {
    if (!cleanText(form.applicant_name)) {
      return assistanceDraft ? '请先填写需求联系人。' : '请先填写申请人。';
    }
    if (!cleanText(form.applicant_phone)) {
      return assistanceDraft ? '请先填写联系方式。' : '请先填写联系电话。';
    }
    if (assistanceDraft) {
      if (!cleanText(form.company)) return '请先填写申请单位。';
      if (!cleanText(form.department)) return '请先填写需求处室。';
      if (!cleanText(form.reason)) return '请先填写协助申请缘由。';
      if (!cleanText(form.request_content)) return '请先填写协助申请内容。';
      return '';
    }

    if (!topology.length) {
      return '当前没有可用的机房拓扑数据，请先确认机房、机柜和设备数据是否已同步。';
    }
    if (!form.items.length) {
      return '请至少填写一台设备。';
    }

    for (let index = 0; index < form.items.length; index += 1) {
      const item = form.items[index];
      const showSource = OUTBOUND_TYPES.has(form.request_type);
      const showTarget = TARGET_TYPES.has(form.request_type);
      if (showSource && !(item.source_datacenter || singleDatacenter?.id)) return `请先为设备 ${index + 1} 选择源机房。`;
      if (showSource && !item.source_rack) return `请先为设备 ${index + 1} 选择源机柜。`;
      if (showTarget && !(item.target_datacenter || singleDatacenter?.id)) return `请先为设备 ${index + 1} 选择目标机房。`;
      if (showTarget && !item.target_rack) return `请先为设备 ${index + 1} 选择目标机柜。`;
      if (!cleanText(item.device_name) && !cleanText(item.rack_device)) return `请先为设备 ${index + 1} 填写设备名称或选择现有设备。`;
    }

    return '';
  };

  const submitDraft = async () => {
    const validationMessage = validateDraft();
    if (validationMessage) {
      setDraftError(validationMessage);
      return;
    }
    setSaving(true);
    setError('');
    setDraftError('');
    try {
      const payload = {
        ...form,
        title: cleanText(form.title),
        applicant_name: cleanText(form.applicant_name),
        applicant_phone: cleanText(form.applicant_phone),
        applicant_email: cleanText(form.applicant_email),
        company: cleanText(form.company),
        department: cleanText(form.department),
        project_name: cleanText(form.project_name),
        reason: cleanText(form.reason),
        request_content: cleanText(form.request_content),
        impact_scope: cleanText(form.impact_scope),
        requires_power_down: !!form.requires_power_down,
        planned_execute_at: form.planned_execute_at || null,
        items: isAssistanceRequest(form.request_type) ? [] : form.items.map(normalizeItem),
      };
      const response = await safeFetch('/api/datacenter-change-requests/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await extractResponseMessage(response, '创建草稿失败。'));
      const result = await response.json().catch(() => ({}));
      setNotice(`已生成独立链接：${result.request_code}`);
      setOpen(false);
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message || '创建草稿失败。');
    } finally {
      setSaving(false);
    }
  };

  const triggerAction = async (id, action, message, body = {}) => {
    setError('');
    try {
      const response = await safeFetch(`/api/datacenter-change-requests/${id}/${action}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await extractResponseMessage(response, '操作失败。'));
      const result = await response.json().catch(() => ({}));
      setNotice(message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || '操作失败。');
    }
  };

  const deleteDraft = async (request) => {
    if (!window.confirm(`确定删除草稿 ${request.request_code || request.title || ''} 吗？`)) return;
    setError('');
    try {
      const response = await safeFetch(`/api/datacenter-change-requests/${request.id}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(formatApiError(result, '删除草稿失败。'));
      }
      setNotice(`草稿 ${request.request_code || request.title || ''} 已删除。`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || '删除草稿失败。');
    }
  };

  const openExecutionModal = (request) => {
    setExecutionTarget(request);
    setExecutionForm(createExecutionForm(request));
    setExecutionOpen(true);
  };

  const submitExecution = async () => {
    if (!executionTarget) return;
    setExecuting(true);
    setError('');
    try {
      const response = await safeFetch(`/api/datacenter-change-requests/${executionTarget.id}/complete/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executor_name: cleanText(executionForm.executor_name),
          execution_comment: cleanText(executionForm.execution_comment),
          items: executionForm.items.map(normalizeExecutionItem),
        }),
      });
      if (!response.ok) throw new Error(await extractResponseMessage(response, executionAssistance ? '处理回填失败。' : '执行回填失败。'));
      const result = await response.json().catch(() => ({}));
      setNotice(`申请 ${result.request?.request_code || executionTarget.request_code} 已${executionAssistance ? '处理回填' : '执行回填'}并标记为完成。`);
      setExecutionOpen(false);
      setExecutionTarget(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || (executionAssistance ? '处理回填失败。' : '执行回填失败。'));
    } finally {
      setExecuting(false);
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('独立链接已复制。');
    } catch {
      setError('复制链接失败，请手动复制。');
    }
  };

  const metrics = [
    { label: '总申请数', value: summary.total },
    { label: '草稿待发', value: summary.draft },
    { label: '待审批', value: summary.submitted },
    { label: '已完成', value: summary.completed },
  ];
  const assistanceDraft = isAssistanceRequest(form.request_type);
  const executionAssistance = isAssistanceRequest(executionTarget?.request_type);

  if (loading && !requests.length) {
    return <div className="p-8 text-sm text-slate-500">正在加载申请中心...</div>;
  }

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-sky-600">统一申请中心</div>
              <h2 className="mt-3 text-[30px] font-black tracking-tight text-slate-900">把设备变更和协助事项都放进同一个申请入口</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-500">管理员先预填基础信息，再生成带时效的独立链接发给对方补充内容。设备类申请继续支持位置、U 位和 IP 预填，协助事项则直接走协助缘由与内容审批。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button"><RefreshCw className="h-4 w-4" />刷新</button>
              <button onClick={() => { resetForm(); setDraftError(''); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700" type="button"><Plus className="h-4 w-4" />新建草稿</button>
            </div>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{metric.label}</div>
              <div className="mt-3 text-[26px] font-black leading-none text-slate-900">{metric.value}</div>
            </div>
          ))}
        </div>

        <ListToolbar
          eyebrow="列表工具栏"
          title="快速搜索与状态筛选"
          description="按申请编号、标题、申请人、申请内容、设备信息或当前状态快速定位。"
          searchValue={filters.query}
          onSearchChange={(value) => setFilters((prev) => ({ ...prev, query: value }))}
          searchPlaceholder="搜索申请编号、标题、申请人、项目、设备名称、管理 IP"
          resultSummary={`当前结果 ${displayRequests.length} / ${requests.length}`}
          filters={
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          }
          actions={
            filters.query || filters.status ? (
              <button
                onClick={() => setFilters({ query: '', status: '' })}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                type="button"
              >
                清空筛选
              </button>
            ) : null
          }
        />

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-black text-slate-900">申请列表</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-6 py-4">申请信息</th>
                  <th className="px-6 py-4">申请人</th>
                  <th className="px-6 py-4">申请摘要</th>
                  <th className="px-6 py-4">状态</th>
                  <th className="px-6 py-4">链接</th>
                  <th className="px-6 py-4">控制</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!displayRequests.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      {requests.length ? '当前筛选条件下没有匹配的申请。' : '当前还没有申请。'}
                    </td>
                  </tr>
                ) : null}
                {displayRequests.map((request) => {
                  const item = request.items?.[0];
                  const assistanceType = isAssistanceRequest(request.request_type);
                  const active = isLinkActive(request);
                  const isFocused = focusedRequestId && String(request.id) === String(focusedRequestId);
                  return (
                    <tr
                      key={request.id}
                      ref={isFocused ? focusedRowRef : null}
                      className={`align-top hover:bg-slate-50/60 ${isFocused ? 'bg-sky-50/80 ring-1 ring-inset ring-sky-200' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{request.title || '未填写标题'}</div>
                        <div className="mt-1 text-xs text-slate-500">{request.request_code} / {REQUEST_TYPE_LABELS[request.request_type] || request.request_type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{request.applicant_name || '待对方补充'}</div>
                        <div className="mt-1 text-xs text-slate-500">{request.applicant_phone || request.company || '待补充联系信息'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{assistanceType ? request.project_name || '未填写项目' : item?.device_name || '未填写设备'}</div>
                        <div className="mt-1 text-xs text-slate-500">{assistanceType ? request.request_content || request.reason || '等待补充协助内容' : item?.assigned_management_ip || item?.device_model || '等待补充'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{STATUS_LABELS[request.status] || request.status}</span>
                        <div className="mt-2 text-xs text-slate-500">{active ? '链接有效' : '链接失效'} / {formatDateTime(request.token_expires_at)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => copyLink(request.public_link)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button"><Copy className="h-3.5 w-3.5" />复制</button>
                          <button onClick={() => window.open(request.public_link, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button"><ExternalLink className="h-3.5 w-3.5" />打开</button>
                          <button onClick={() => window.open(`/api/datacenter-change-requests/${request.id}/export_pdf/`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button"><FileText className="h-3.5 w-3.5" />PDF</button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {request.status === 'draft' ? <button onClick={() => triggerAction(request.id, 'submit', `申请 ${request.request_code} 已提交审批。`)} className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700" type="button"><Send className="h-3.5 w-3.5" />提交</button> : null}
                          {request.status === 'draft' ? <button onClick={() => deleteDraft(request)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" type="button"><Trash2 className="h-3.5 w-3.5" />删除</button> : null}
                          {request.status === 'submitted' ? (
                            <>
                              <button onClick={() => triggerAction(request.id, 'approve', `申请 ${request.request_code} 已批准。`)} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700" type="button"><CheckCircle2 className="h-3.5 w-3.5" />批准</button>
                              <button onClick={() => triggerAction(request.id, 'reject', `申请 ${request.request_code} 已驳回。`)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" type="button"><XCircle className="h-3.5 w-3.5" />驳回</button>
                            </>
                          ) : null}
                          {['approved', 'scheduled'].includes(request.status) ? <button onClick={() => openExecutionModal(request)} className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700" type="button"><Wrench className="h-3.5 w-3.5" />{assistanceType ? '处理回填' : '执行回填'}</button> : null}
                          <button onClick={() => triggerAction(request.id, 'set_link_expiry', '链接有效期已设置为 7 天。', { expires_in_days: 7 })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button">7天</button>
                          <button onClick={() => triggerAction(request.id, 'set_link_expiry', '链接有效期已设置为 30 天。', { expires_in_days: 30 })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" type="button">30天</button>
                          {active ? <button onClick={() => triggerAction(request.id, 'revoke_link', '公开申请链接已作废。')} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" type="button"><Link2Off className="h-3.5 w-3.5" />作废</button> : <button onClick={() => triggerAction(request.id, 'restore_link', '公开申请链接已恢复。', { expires_in_days: 14 })} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700" type="button"><RotateCcw className="h-3.5 w-3.5" />恢复</button>}
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

      <Modal isOpen={open} onClose={() => { setDraftError(''); setOpen(false); }} title="新建申请草稿并生成独立链接" size="xl">
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {assistanceDraft
              ? '协助事项申请会生成一条临时链接，申请人只需要补充协助缘由、内容和联系人信息即可。'
              : '设备类申请会先由管理员预填位置和网络信息，再把独立链接发给对方补充资料。单机房场景下默认隐藏机房选择。'}
          </div>
          {draftError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{draftError}</div> : null}
          {!assistanceDraft && !topology.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">当前未加载到可用的机房拓扑数据，设备类申请无法联动机房、机柜和现有设备。请先检查机房数据，或点击页面右上角“刷新”后重试。</div> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-slate-700">申请类型<select value={form.request_type} onChange={(e) => updateField('request_type', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">{REQUEST_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm text-slate-700">申请标题<input value={form.title} onChange={(e) => updateField('title', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{assistanceDraft ? '需求联系人' : '申请人'}<input value={form.applicant_name} onChange={(e) => updateField('applicant_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{assistanceDraft ? '联系方式' : '联系电话'}<input value={form.applicant_phone} onChange={(e) => updateField('applicant_phone', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">联系邮箱<input value={form.applicant_email} onChange={(e) => updateField('applicant_email', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{assistanceDraft ? '申请单位' : '所属单位'}<input value={form.company} onChange={(e) => updateField('company', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{assistanceDraft ? '需求处室' : '所属部门'}<input value={form.department} onChange={(e) => updateField('department', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{assistanceDraft ? '项目名称' : '所属项目'}<input value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{assistanceDraft ? '期望协助时间' : '计划处理时间'}<input type="datetime-local" value={form.planned_execute_at} onChange={(e) => updateField('planned_execute_at', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          </div>

          {assistanceDraft ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700">协助申请缘由<textarea value={form.reason} onChange={(e) => updateField('reason', e.target.value)} className="mt-1 h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
              <label className="text-sm text-slate-700">协助申请内容<textarea value={form.request_content} onChange={(e) => updateField('request_content', e.target.value)} className="mt-1 h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            </div>
          ) : null}

          {!assistanceDraft ? form.items.map((item, index) => {
            const sourceDatacenterId = item.source_datacenter || (singleDatacenter ? String(singleDatacenter.id) : '');
            const targetDatacenterId = item.target_datacenter || (singleDatacenter ? String(singleDatacenter.id) : '');
            const sourceDatacenter = topology.find((dc) => String(dc.id) === String(sourceDatacenterId));
            const targetDatacenter = topology.find((dc) => String(dc.id) === String(targetDatacenterId));
            const sourceRack = sourceDatacenter?.racks?.find((rack) => String(rack.id) === String(item.source_rack));
            const targetRack = targetDatacenter?.racks?.find((rack) => String(rack.id) === String(item.target_rack));
            const showSource = OUTBOUND_TYPES.has(form.request_type);
            const showTarget = TARGET_TYPES.has(form.request_type);
            return (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900">设备 {index + 1}</div>
                  {form.items.length > 1 ? <button onClick={() => removeItem(index)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600" type="button"><Trash2 className="h-3.5 w-3.5" />删除</button> : null}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {showSource && !singleDatacenter ? <label className="text-sm text-slate-700">源机房<select value={item.source_datacenter} onChange={(e) => { updateItem(index, 'source_datacenter', e.target.value); updateItem(index, 'source_rack', ''); updateItem(index, 'rack_device', ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">请选择</option>{topology.map((dc) => <option key={dc.id} value={dc.id}>{dc.name}</option>)}</select></label> : null}
                  {showSource ? <label className="text-sm text-slate-700">源机柜<select value={item.source_rack} onChange={(e) => { updateItem(index, 'source_rack', e.target.value); updateItem(index, 'rack_device', ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">请选择</option>{(sourceDatacenter?.racks || []).map((rack) => <option key={rack.id} value={rack.id}>{rack.name || rack.code}</option>)}</select></label> : null}
                  {showSource ? <label className="text-sm text-slate-700">现有设备<select value={item.rack_device} onChange={(e) => { updateItem(index, 'rack_device', e.target.value); applyDevicePreset(index, item.source_rack, e.target.value); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">可选</option>{(sourceRack?.devices || []).map((device) => <option key={device.id} value={device.id}>{device.name}{device.mgmt_ip ? ` / ${device.mgmt_ip}` : ''}</option>)}</select></label> : null}
                  <label className="text-sm text-slate-700">设备名称<input value={item.device_name} onChange={(e) => updateItem(index, 'device_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">设备型号<input value={item.device_model} onChange={(e) => updateItem(index, 'device_model', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">序列号<input value={item.serial_number} onChange={(e) => updateItem(index, 'serial_number', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">数量<input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">占用 U 数<input type="number" min="1" value={item.u_height} onChange={(e) => updateItem(index, 'u_height', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">网络需求<select value={item.network_role} onChange={(e) => updateItem(index, 'network_role', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">{NETWORK_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-sm text-slate-700">IP 动作<select value={item.ip_action} onChange={(e) => updateItem(index, 'ip_action', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">{IP_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-sm text-slate-700">预分配管理 IP<input value={item.assigned_management_ip} onChange={(e) => updateItem(index, 'assigned_management_ip', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">预分配业务 IP<input value={item.assigned_service_ip} onChange={(e) => updateItem(index, 'assigned_service_ip', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  {showTarget && !singleDatacenter ? <label className="text-sm text-slate-700">目标机房<select value={item.target_datacenter} onChange={(e) => { updateItem(index, 'target_datacenter', e.target.value); updateItem(index, 'target_rack', ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">请选择</option>{topology.map((dc) => <option key={dc.id} value={dc.id}>{dc.name}</option>)}</select></label> : null}
                  {showTarget ? <label className="text-sm text-slate-700">目标机柜<select value={item.target_rack} onChange={(e) => updateItem(index, 'target_rack', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">请选择</option>{(targetDatacenter?.racks || []).map((rack) => <option key={rack.id} value={rack.id}>{rack.name || rack.code}</option>)}</select></label> : null}
                  {showSource ? <label className="text-sm text-slate-700">源 U 位<input value={item.source_u_start} onChange={(e) => updateItem(index, 'source_u_start', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label> : null}
                  {showTarget ? <label className="text-sm text-slate-700">目标 U 位<input value={item.target_u_start} onChange={(e) => updateItem(index, 'target_u_start', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label> : null}
                </div>
                {showSource ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">源机柜占用：{sourceRack ? `${sourceRack.name || sourceRack.code} / ${sourceRack.height}U / 已占用 ${sourceRack.occupied_ranges?.length || 0} 段` : '请选择机柜'}</div> : null}
                {showTarget ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">目标机柜占用：{targetRack ? `${targetRack.name || targetRack.code} / ${targetRack.height}U / 已占用 ${targetRack.occupied_ranges?.length || 0} 段` : '请选择机柜'}</div> : null}
              </div>
            );
          }) : null}
          {!assistanceDraft ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700">申请原因<textarea value={form.reason} onChange={(e) => updateField('reason', e.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
              <label className="text-sm text-slate-700">影响范围<textarea value={form.impact_scope} onChange={(e) => updateField('impact_scope', e.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            </div>
          ) : null}
          {!assistanceDraft ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!form.requires_power_down} onChange={(e) => updateField('requires_power_down', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
              本次申请涉及下电窗口
            </label>
          ) : null}
          <div className="flex items-center justify-between">
            <div>
              {!assistanceDraft ? <button onClick={addItem} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">增加设备</button> : null}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">取消</button>
              <button onClick={submitDraft} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300" type="button">{saving ? '生成中...' : '生成独立链接'}</button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={executionOpen} onClose={() => setExecutionOpen(false)} title={executionAssistance ? '处理回填与完成确认' : '执行回填与完成确认'} size="xl">
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {executionAssistance
              ? '审批通过后，在这里回填实际处理人和处理备注，确认协助事项已经处理完成。'
              : '审批通过后，在这里回填实际执行结果。设备位置、管理 IP 和备注会同步更新到设备台账与 IP 地址记录。'}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">{executionAssistance ? '处理人' : '执行人'}<input value={executionForm.executor_name} onChange={(e) => updateExecutionField('executor_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm text-slate-700">{executionAssistance ? '处理备注' : '执行备注'}<textarea value={executionForm.execution_comment} onChange={(e) => updateExecutionField('execution_comment', e.target.value)} className="mt-1 h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          </div>
          {executionAssistance ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              该申请类型不涉及设备明细，本次回填只会记录处理人、处理时间和处理备注。
            </div>
          ) : null}
          {!executionAssistance ? executionForm.items.map((item, index) => {
            const requestType = executionTarget?.request_type;
            const showSource = OUTBOUND_TYPES.has(requestType);
            const showTarget = TARGET_TYPES.has(requestType);
            return (
              <div key={`execution-${item.id || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="font-bold text-slate-900">执行设备 {index + 1}</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="text-sm text-slate-700">设备名称<input value={item.device_name} onChange={(e) => updateExecutionItem(index, 'device_name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">管理 IP<input value={item.assigned_management_ip} onChange={(e) => updateExecutionItem(index, 'assigned_management_ip', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm text-slate-700">业务 IP<input value={item.assigned_service_ip} onChange={(e) => updateExecutionItem(index, 'assigned_service_ip', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  {showSource ? <label className="text-sm text-slate-700">源机柜 ID<input value={item.source_rack} onChange={(e) => updateExecutionItem(index, 'source_rack', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label> : null}
                  {showSource ? <label className="text-sm text-slate-700">源起始 U 位<input value={item.source_u_start} onChange={(e) => updateExecutionItem(index, 'source_u_start', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label> : null}
                  {showTarget ? <label className="text-sm text-slate-700">目标机柜 ID<input value={item.target_rack} onChange={(e) => updateExecutionItem(index, 'target_rack', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label> : null}
                  {showTarget ? <label className="text-sm text-slate-700">目标起始 U 位<input value={item.target_u_start} onChange={(e) => updateExecutionItem(index, 'target_u_start', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label> : null}
                  <label className="text-sm text-slate-700">功率 W<input type="number" min="0" value={item.power_watts} onChange={(e) => updateExecutionItem(index, 'power_watts', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                </div>
                <label className="text-sm text-slate-700">执行备注<textarea value={item.notes} onChange={(e) => updateExecutionItem(index, 'notes', e.target.value)} className="mt-1 h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
              </div>
            );
          }) : null}
          <div className="flex justify-end gap-3">
            <button onClick={() => setExecutionOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">取消</button>
            <button onClick={submitExecution} disabled={executing} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:bg-slate-300" type="button">{executing ? '提交中...' : executionAssistance ? '确认处理完成' : '确认执行完成'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
