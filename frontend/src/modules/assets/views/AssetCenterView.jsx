import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Columns3,
  ClipboardList,
  Database,
  Filter,
  HardDrive,
  KeyRound,
  MapPin,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

import { safeFetch } from '../../../lib/api';

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

const safeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const inventoryToken = (value, fallback = 'unknown') => {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || fallback;
};

const SORT_OPTIONS = [
  { value: 'risk:desc', label: '风险最多优先' },
  { value: 'backup:asc', label: '配置未接入优先' },
  { value: 'automation:desc', label: '未纳管优先' },
  { value: 'name:asc', label: '资产名称 A-Z' },
  { value: 'location:asc', label: '位置 A-Z' },
  { value: 'status:desc', label: '异常状态优先' },
  { value: 'credential:desc', label: '密码风险优先' },
  { value: 'owner:asc', label: '责任人 A-Z' },
  { value: 'type:asc', label: '设备类型 A-Z' },
  { value: 'updated:desc', label: '最近更新优先' },
];

const SORT_LABELS = {
  name: '资产',
  location: '位置',
  status: '状态',
  backup: '配置备份',
  credential: '密码',
  automation: '自动化',
  owner: '责任',
  risk: '风险',
  type: '类型',
  updated: '更新',
};

const COLUMN_DEFINITIONS = [
  { id: 'asset', label: '资产', sortKey: 'name', required: true, defaultVisible: true },
  { id: 'status', label: '在线状态', sortKey: 'status', defaultVisible: true },
  { id: 'credential', label: '密码', sortKey: 'credential', defaultVisible: true },
  { id: 'backup', label: '配置备份', sortKey: 'backup', defaultVisible: true },
  { id: 'automation', label: 'Ansible', sortKey: 'automation', defaultVisible: true },
  { id: 'recent', label: '最近版本', sortKey: 'updated', defaultVisible: true },
  { id: 'location', label: '位置', sortKey: 'location', defaultVisible: true },
  { id: 'owner', label: '责任', sortKey: 'owner', defaultVisible: true },
  { id: 'type', label: '类型', sortKey: 'type', defaultVisible: false },
  { id: 'risk', label: '风险', sortKey: 'risk', defaultVisible: true },
];

const COLUMN_WIDTHS = {
  asset: 'min-w-[260px]',
  status: 'min-w-[120px]',
  credential: 'min-w-[130px]',
  backup: 'min-w-[150px]',
  automation: 'min-w-[145px]',
  recent: 'min-w-[150px]',
  location: 'min-w-[160px]',
  owner: 'min-w-[160px]',
  type: 'min-w-[130px]',
  risk: 'min-w-[180px]',
};

const DEFAULT_VISIBLE_COLUMNS = COLUMN_DEFINITIONS.reduce((acc, column) => {
  acc[column.id] = column.defaultVisible !== false;
  return acc;
}, {});

const DETAIL_TABS = [
  { id: 'basic', label: '基础信息', shortLabel: '基础', icon: Server },
  { id: 'backup', label: '配置备份', shortLabel: '备份', icon: Database },
  { id: 'credential', label: '密码凭据', shortLabel: '密码', icon: KeyRound },
  { id: 'ansible', label: 'Ansible', shortLabel: 'Ansible', icon: Terminal },
  { id: 'changes', label: '变更记录', shortLabel: '变更', icon: ClipboardList },
];

const STATUS_SORT_WEIGHT = {
  offline: 6,
  unknown: 5,
  maintenance: 4,
  planned: 3,
  retired: 2,
  removed: 2,
  decommissioned: 2,
  reserved: 1,
  active: 0,
  online: 0,
};

const CREDENTIAL_SORT_WEIGHT = {
  missing: 6,
  expired: 5,
  expiring: 4,
  unavailable: 3,
  disabled: 2,
  active: 0,
};

const DEFAULT_SORT_DIRECTIONS = {
  name: 'asc',
  location: 'asc',
  status: 'desc',
  backup: 'asc',
  credential: 'desc',
  automation: 'desc',
  owner: 'asc',
  risk: 'desc',
  type: 'asc',
  updated: 'desc',
};

const DEVICE_TYPE_LABELS = {
  server: '服务器',
  vm: '虚拟机',
  switch_core: '核心交换机',
  switch_access: '接入交换机',
  switch: '交换机',
  router: '路由器',
  firewall: '防火墙',
  storage: '存储',
  storage_device: '存储',
  security: '安全设备',
  ups: 'UPS',
  pdu: 'PDU',
  odf: 'ODF',
  pc: '终端',
  printer: '打印机',
  other: '其他设备',
  unknown: '未分类',
};

const STATUS_LABELS = {
  active: '运行中',
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
  planned: '规划中',
  retired: '已退役',
  removed: '已下架',
  decommissioned: '已退役',
  reserved: '保留',
  unknown: '未检测',
};

const STATUS_TONES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  maintenance: 'bg-amber-50 text-amber-700 ring-amber-200',
  planned: 'bg-sky-50 text-sky-700 ring-sky-200',
  reserved: 'bg-sky-50 text-sky-700 ring-sky-200',
  retired: 'bg-slate-100 text-slate-600 ring-slate-200',
  removed: 'bg-slate-100 text-slate-600 ring-slate-200',
  decommissioned: 'bg-slate-100 text-slate-600 ring-slate-200',
  offline: 'bg-rose-50 text-rose-700 ring-rose-200',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const SECRET_LABELS = {
  active: '已受控',
  expiring: '即将过期',
  expired: '已过期',
  disabled: '已停用',
  missing: '未绑定',
  unavailable: '未加载',
};

const SECRET_TONES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  expiring: 'bg-amber-50 text-amber-700 ring-amber-200',
  expired: 'bg-rose-50 text-rose-700 ring-rose-200',
  disabled: 'bg-slate-100 text-slate-600 ring-slate-200',
  missing: 'bg-rose-50 text-rose-700 ring-rose-200',
  unavailable: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const RISK_LABELS = {
  offline: '不可达',
  credential: '密码未受控',
  backup: '配置未接入',
  automation: '未纳管',
};

const CONFIG_BACKUP_STATUS_LABELS = {
  not_run: '未执行',
  running: '执行中',
  success: '成功',
  failed: '失败',
  disabled: '已停用',
};

function Pill({ children, tone = 'bg-slate-100 text-slate-700 ring-slate-200' }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, label, value, tone = 'text-slate-700', subtext }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{subtext}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <div>
        <Server className="mx-auto h-8 w-8 text-slate-400" />
        <div className="mt-3 text-sm font-bold text-slate-800">暂无资产数据</div>
        <div className="mt-1 text-sm text-slate-500">当前筛选条件下没有可显示的设备。</div>
      </div>
    </div>
  );
}

function buildAssets({ datacenters, racks, rackDevices, ips, secrets, configBackups, secretsLoaded }) {
  const datacenterMap = new Map(asArray(datacenters).map((item) => [String(item.id), item]));
  const rackMap = new Map(asArray(racks).map((item) => [String(item.id), item]));
  const ipList = asArray(ips);
  const secretList = asArray(secrets);
  const configBackupMap = new Map(Object.entries(configBackups?.devices || {}));
  const configBackupTargetMap = new Map(Object.entries(configBackups?.targets || {}));
  const usedIpIds = new Set();
  const usedDeviceKeys = new Set();

  const findIpsForDevice = (device) => {
    const deviceName = normalize(device.name);
    const mgmtIp = normalize(device.mgmt_ip);
    return ipList.filter((ip) => {
      const matchesManagementIp = mgmtIp && normalize(ip.ip_address) === mgmtIp;
      const matchesName = deviceName && normalize(ip.device_name) === deviceName;
      if (matchesManagementIp || matchesName) usedIpIds.add(String(ip.id));
      return matchesManagementIp || matchesName;
    });
  };

  const getSecretState = (assetIpIds, deviceId) => {
    if (!secretsLoaded) {
      return { status: 'unavailable', count: 0, items: [] };
    }
    const related = secretList.filter((secret) => {
      const byDevice = secret.rack_device && String(secret.rack_device) === String(deviceId);
      const byIp = secret.ip_address && assetIpIds.has(String(secret.ip_address));
      return byDevice || byIp;
    });
    if (related.length === 0) {
      return { status: 'missing', count: 0, items: [] };
    }
    const states = related.map((item) => item.lifecycle_status || item.status || 'active');
    const status = states.includes('expired')
      ? 'expired'
      : states.includes('expiring')
        ? 'expiring'
        : states.includes('disabled')
          ? 'disabled'
          : 'active';
    return { status, count: related.length, items: related };
  };

  const getConfigBackupState = (managementIp) => {
    const ipKey = String(managementIp || '').trim();
    const entry = configBackupMap.get(ipKey);
    const target = configBackupTargetMap.get(ipKey) || entry?.target || null;
    if (!entry) {
      return {
        status: 'pending',
        label: target ? '待执行' : '待接入',
        versionCount: 0,
        latestVersion: '-',
        lastBackupAt: null,
        lastResult: target?.last_error || (configBackups?.directory_exists === false ? '备份目录不可用' : '未采集'),
        versions: [],
        target,
        targetId: target?.id || null,
        targetEnabled: target?.enabled ?? false,
        targetStatus: target?.last_status || 'not_run',
        targetStatusLabel: CONFIG_BACKUP_STATUS_LABELS[target?.last_status || 'not_run'] || target?.last_status || '未执行',
        targetCredentialName: target?.credential_name || '',
        targetError: target?.last_error || '',
      };
    }
    const latest = entry.latest || entry.versions?.[0] || null;
    const latestTime = latest?.time_iso || latest?.finished_at || latest?.started_at || latest?.time || latest?.created_at || null;
    const latestStatusLabel = latest?.status_label
      || CONFIG_BACKUP_STATUS_LABELS[latest?.status]
      || CONFIG_BACKUP_STATUS_LABELS[target?.last_status]
      || '成功';
    return {
      status: entry.version_count > 0 ? 'ready' : 'pending',
      label: entry.version_count > 0 ? '已接入' : '待接入',
      versionCount: entry.version_count || 0,
      latestVersion: latest?.filename || latest?.name || '-',
      lastBackupAt: latestTime,
      lastResult: latestStatusLabel,
      versions: entry.versions || [],
      storagePath: latest?.relative_path || '',
      deviceType: entry.device_type || '',
      target,
      targetId: target?.id || null,
      targetEnabled: target?.enabled ?? false,
      targetStatus: target?.last_status || 'not_run',
      targetStatusLabel: CONFIG_BACKUP_STATUS_LABELS[target?.last_status || 'not_run'] || target?.last_status || '未执行',
      targetCredentialName: target?.credential_name || '',
      targetError: target?.last_error || '',
    };
  };

  const deviceAssets = asArray(rackDevices).map((device) => {
    usedDeviceKeys.add(normalize(device.name));
    const rack = rackMap.get(String(device.rack));
    const datacenter = rack ? datacenterMap.get(String(rack.datacenter)) : null;
    const relatedIps = findIpsForDevice(device);
    const assetIpIds = new Set(relatedIps.map((ip) => String(ip.id)));
    const credential = getSecretState(assetIpIds, device.id);
    const status = device.status || 'unknown';
    const managementIp = device.mgmt_ip || relatedIps[0]?.ip_address || '';
    const backup = getConfigBackupState(managementIp);
    const riskCodes = [];
    if (['offline', 'unknown'].includes(status)) riskCodes.push('offline');
    if (credential.status === 'missing') riskCodes.push('credential');
    if (backup.versionCount === 0 && backup.status !== 'ready') riskCodes.push('backup');
    riskCodes.push('automation');

    return {
      id: `device-${device.id}`,
      source: 'device',
      deviceId: device.id,
      name: safeText(device.name, `设备 ${device.id}`),
      type: device.device_type || 'unknown',
      typeLabel: DEVICE_TYPE_LABELS[device.device_type] || device.device_type || DEVICE_TYPE_LABELS.unknown,
      vendor: device.brand || '',
      model: device.model || '',
      osVersion: device.os_version || '',
      serialNumber: device.sn || '',
      assetTag: device.asset_tag || '',
      managementIp,
      status,
      datacenterName: datacenter?.name || '',
      rackCode: rack?.code || '',
      rackName: rack?.name || '',
      rackPosition: device.position ? `U${device.position}${device.u_height > 1 ? `-${safeInt(device.position) + safeInt(device.u_height) - 1}` : ''}` : '',
      project: device.project || '',
      contact: device.contact || '',
      powerUsage: safeInt(device.power_usage),
      typicalPower: safeInt(device.typical_power),
      specs: device.specs || '',
      relatedIps,
      credential,
      backup,
      automation: {
        managed: false,
        label: '未纳管',
        inventoryName: device.mgmt_ip || device.name || '',
        groups: [],
        lastJobStatus: '未执行',
      },
      riskCodes,
      updatedAt: device.updated_at || device.created_at || '',
    };
  });

  const ipOnlyAssets = ipList
    .filter((ip) => ip.device_name && !usedIpIds.has(String(ip.id)) && !usedDeviceKeys.has(normalize(ip.device_name)))
    .map((ip) => {
      const assetIpIds = new Set([String(ip.id)]);
      const credential = getSecretState(assetIpIds, null);
      const status = ip.status || 'unknown';
      const backup = getConfigBackupState(ip.ip_address);
      const riskCodes = [];
      if (['offline', 'unknown'].includes(status)) riskCodes.push('offline');
      if (credential.status === 'missing') riskCodes.push('credential');
      if (backup.versionCount === 0 && backup.status !== 'ready') riskCodes.push('backup');
      riskCodes.push('automation');

      return {
        id: `ip-${ip.id}`,
        source: 'ip',
        deviceId: null,
        name: safeText(ip.device_name, ip.ip_address),
        type: ip.device_type || 'unknown',
        typeLabel: DEVICE_TYPE_LABELS[ip.device_type] || ip.device_type || DEVICE_TYPE_LABELS.unknown,
        vendor: '',
        model: '',
        osVersion: '',
        serialNumber: '',
        assetTag: '',
        managementIp: ip.ip_address || '',
        status,
        datacenterName: '',
        rackCode: '',
        rackName: '',
        rackPosition: '',
        project: '',
        contact: ip.owner || '',
        powerUsage: 0,
        typicalPower: 0,
        specs: ip.description || '',
        relatedIps: [ip],
        credential,
        backup,
        automation: {
          managed: false,
          label: '未纳管',
          inventoryName: ip.ip_address || ip.device_name || '',
          groups: [],
          lastJobStatus: '未执行',
        },
        riskCodes,
        updatedAt: ip.last_online || '',
      };
    });

  return [...deviceAssets, ...ipOnlyAssets].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function filterAssets(assets, filters) {
  const keyword = normalize(filters.keyword);
  return assets.filter((asset) => {
    if (filters.status !== 'all' && asset.status !== filters.status) return false;
    if (filters.type !== 'all' && asset.type !== filters.type) return false;
    if (filters.risk !== 'all' && !asset.riskCodes.includes(filters.risk)) return false;
    if (filters.credential !== 'all' && asset.credential.status !== filters.credential) return false;
    if (filters.backup !== 'all') {
      const backedUp = asset.backup.versionCount > 0 || asset.backup.status === 'ready';
      if (filters.backup === 'ready' && !backedUp) return false;
      if (filters.backup === 'missing' && backedUp) return false;
      if (!['ready', 'missing'].includes(filters.backup) && asset.backup.status !== filters.backup) return false;
    }
    if (filters.automation !== 'all') {
      if (filters.automation === 'managed' && !asset.automation.managed) return false;
      if (filters.automation === 'unmanaged' && asset.automation.managed) return false;
    }
    if (!keyword) return true;
    return [
      asset.name,
      asset.managementIp,
      asset.typeLabel,
      asset.vendor,
      asset.model,
      asset.serialNumber,
      asset.assetTag,
      asset.datacenterName,
      asset.rackCode,
      asset.project,
      asset.contact,
      ...asset.relatedIps.map((ip) => ip.ip_address),
    ].some((value) => normalize(value).includes(keyword));
  });
}

const comparePrimitive = (left, right) => {
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left || 0) - Number(right || 0);
  }
  return String(left || '').localeCompare(String(right || ''), 'zh-CN', { numeric: true });
};

const getSortValue = (asset, key) => {
  if (key === 'name') return asset.name;
  if (key === 'location') return [asset.datacenterName, asset.rackCode, asset.rackPosition].filter(Boolean).join(' / ');
  if (key === 'status') return STATUS_SORT_WEIGHT[asset.status] ?? 3;
  if (key === 'backup') return asset.backup.versionCount || 0;
  if (key === 'credential') return (CREDENTIAL_SORT_WEIGHT[asset.credential.status] ?? 3) * 1000 - asset.credential.count;
  if (key === 'automation') return asset.automation.managed ? 0 : 1;
  if (key === 'owner') return [asset.project, asset.contact].filter(Boolean).join(' / ');
  if (key === 'risk') return asset.riskCodes.length;
  if (key === 'type') return asset.typeLabel;
  if (key === 'updated') return asset.updatedAt ? new Date(asset.updatedAt).getTime() || 0 : 0;
  return asset.name;
};

function sortAssets(assets, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return assets
    .map((asset, index) => ({ asset, index }))
    .sort((left, right) => {
      const primary = comparePrimitive(getSortValue(left.asset, sort.key), getSortValue(right.asset, sort.key));
      if (primary !== 0) return primary * direction;
      const fallback = comparePrimitive(left.asset.name, right.asset.name);
      if (fallback !== 0) return fallback;
      return left.index - right.index;
    })
    .map((item) => item.asset);
}

const countBy = (assets, getKey) => {
  const grouped = new Map();
  assets.forEach((asset) => {
    const key = getKey(asset) || '未标注';
    const current = grouped.get(key) || {
      label: key,
      count: 0,
      risk: 0,
      offline: 0,
      credentialMissing: 0,
    };
    current.count += 1;
    current.risk += asset.riskCodes.length;
    if (['offline', 'unknown'].includes(asset.status)) current.offline += 1;
    if (asset.credential.status === 'missing') current.credentialMissing += 1;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((left, right) => right.count - left.count || right.risk - left.risk);
};

function buildGroupSummary(assets) {
  const riskRows = Object.entries(RISK_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      count: assets.filter((asset) => asset.riskCodes.includes(key)).length,
    }))
    .sort((left, right) => right.count - left.count);

  return {
    datacenters: countBy(assets, (asset) => asset.datacenterName || '未标注机房'),
    types: countBy(assets, (asset) => asset.typeLabel || '未分类'),
    risks: riskRows,
  };
}

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
  return direction === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />;
}

function SortHeader({ children, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-black transition ${active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
      title={`按${SORT_LABELS[sortKey] || children}排序`}
    >
      {children}
      <SortIcon active={active} direction={sort.direction} />
    </button>
  );
}

function StatBar({ label, count, total, meta, tone = 'bg-blue-500' }) {
  const percent = total && count ? Math.max(4, Math.round((count / total) * 100)) : 0;
  return (
    <div className="rounded-md bg-slate-50 px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-xs font-bold text-slate-800">{label}</span>
        <span className="text-xs font-black text-slate-950">{count}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      {meta ? <div className="mt-1 truncate text-[11px] text-slate-500">{meta}</div> : null}
    </div>
  );
}

function SummaryColumn({ icon: Icon, title, children }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-2 text-xs font-black text-slate-900">
        <Icon className="h-3.5 w-3.5 text-blue-600" />
        {title}
      </div>
      {children}
    </div>
  );
}

function GroupSummary({ summary, total }) {
  const leaders = [
    { label: '机房', value: summary.datacenters[0]?.label, count: summary.datacenters[0]?.count },
    { label: '类型', value: summary.types[0]?.label, count: summary.types[0]?.count },
    { label: '风险', value: summary.risks[0]?.label, count: summary.risks[0]?.count },
  ].filter((item) => item.value);

  return (
    <details className="group rounded-lg border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-950">资产分布摘要</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">默认收起，展开后查看机房、类型和风险集中区域。</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {leaders.map((item) => (
            <span key={item.label} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {item.label}：{item.value} {item.count ?? 0}
            </span>
          ))}
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{total} 条资产</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </div>
      </summary>
      <div className="grid gap-3 border-t border-slate-100 px-4 pb-4 pt-3 xl:grid-cols-3">
        <SummaryColumn icon={BarChart3} title="机房分布">
          {summary.datacenters.slice(0, 4).map((item) => (
            <StatBar
              key={item.label}
              label={item.label}
              count={item.count}
              total={total}
              meta={`${item.offline} 离线/未检测，${item.credentialMissing} 未绑密码`}
              tone="bg-blue-500"
            />
          ))}
        </SummaryColumn>

        <SummaryColumn icon={HardDrive} title="类型分布">
          {summary.types.slice(0, 4).map((item) => (
            <StatBar
              key={item.label}
              label={item.label}
              count={item.count}
              total={total}
              meta={`${item.risk} 个风险标签`}
              tone="bg-violet-500"
            />
          ))}
        </SummaryColumn>

        <SummaryColumn icon={AlertTriangle} title="风险分布">
          {summary.risks.map((item) => (
            <StatBar
              key={item.key}
              label={item.label}
              count={item.count}
              total={total}
              meta={item.count ? '需要处理' : '当前无'}
              tone="bg-rose-500"
            />
          ))}
        </SummaryColumn>
      </div>
    </details>
  );
}

function ColumnVisibilityControl({ visibleColumns, onToggleColumn }) {
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700">
        <Columns3 className="h-3.5 w-3.5" />
        列
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
        {COLUMN_DEFINITIONS.map((column) => (
          <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={!!visibleColumns[column.id]}
              disabled={column.required}
              onChange={() => onToggleColumn(column.id)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{column.label}</span>
            {column.required ? <span className="ml-auto text-[11px] text-slate-400">固定</span> : null}
          </label>
        ))}
      </div>
    </details>
  );
}

const backupTone = (backup) => {
  if ((backup?.versionCount || 0) > 0 || backup?.status === 'ready') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (backup?.status === 'failed') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const automationTone = (automation) => (
  automation?.managed
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-slate-100 text-slate-600 ring-slate-200'
);

function renderAssetCell(asset, columnId) {
  if (columnId === 'asset') {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
          <HardDrive className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-950">{asset.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{asset.typeLabel}</span>
            {asset.managementIp ? <span className="font-mono">{asset.managementIp}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  if (columnId === 'status') {
    return <Pill tone={STATUS_TONES[asset.status] || STATUS_TONES.unknown}>{STATUS_LABELS[asset.status] || asset.status}</Pill>;
  }

  if (columnId === 'credential') {
    return (
      <div>
        <Pill tone={SECRET_TONES[asset.credential.status]}>{SECRET_LABELS[asset.credential.status]}</Pill>
        <div className="mt-1 text-xs text-slate-500">{asset.credential.count} 条凭据</div>
      </div>
    );
  }

  if (columnId === 'backup') {
    return (
      <div>
        <Pill tone={backupTone(asset.backup)}>{asset.backup.label}</Pill>
        <div className="mt-1 text-xs text-slate-500">{asset.backup.versionCount} 个版本</div>
      </div>
    );
  }

  if (columnId === 'automation') {
    return (
      <div>
        <Pill tone={automationTone(asset.automation)}>{asset.automation.label}</Pill>
        <div className="mt-1 text-xs text-slate-500">{asset.automation.inventoryName || '-'}</div>
      </div>
    );
  }

  if (columnId === 'recent') {
    return (
      <div className="text-xs text-slate-500">
        <div className="font-bold text-slate-800">{asset.backup.latestVersion || '-'}</div>
        <div className="mt-1">{formatTime(asset.backup.lastBackupAt || asset.updatedAt)}</div>
      </div>
    );
  }

  if (columnId === 'location') {
    return (
      <div className="text-slate-600">
        <div className="font-semibold text-slate-800">{asset.datacenterName || '-'}</div>
        <div className="mt-1 text-xs">{[asset.rackCode, asset.rackPosition].filter(Boolean).join(' / ') || '-'}</div>
      </div>
    );
  }

  if (columnId === 'owner') {
    return (
      <div className="text-slate-600">
        <div className="font-semibold text-slate-800">{asset.project || '-'}</div>
        <div className="mt-1 text-xs">{asset.contact || '-'}</div>
      </div>
    );
  }

  if (columnId === 'type') {
    return (
      <div>
        <div className="font-semibold text-slate-800">{asset.typeLabel}</div>
        <div className="mt-1 text-xs text-slate-500">{asset.vendor || '-'}</div>
      </div>
    );
  }

  if (columnId === 'risk') {
    return (
      <div className="flex max-w-[180px] flex-wrap gap-1.5">
        {asset.riskCodes.length ? (
          asset.riskCodes.slice(0, 3).map((risk) => (
            <Pill key={risk} tone="bg-rose-50 text-rose-700 ring-rose-200">{RISK_LABELS[risk]}</Pill>
          ))
        ) : (
          <Pill tone="bg-emerald-50 text-emerald-700 ring-emerald-200">正常</Pill>
        )}
      </div>
    );
  }

  return '-';
}

function AssetTable({ assets, selectedAssetId, onSelect, sort, onSort, sortLabel, visibleColumns, onToggleColumn }) {
  if (assets.length === 0) return <EmptyState />;
  const renderedColumns = COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.id]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-sm font-black text-slate-950">资产清单</div>
          <div className="mt-0.5 text-xs text-slate-500">点击表头排序，点击行查看右侧资产档案；列可按当前工作场景开关。</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-md bg-slate-100 px-2.5 py-1">{assets.length} 条</span>
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-blue-700">{sortLabel}</span>
          <ColumnVisibilityControl visibleColumns={visibleColumns} onToggleColumn={onToggleColumn} />
        </div>
      </div>
      <div className="max-h-[calc(100vh-18rem)] overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${Math.max(980, renderedColumns.length * 150 + 160)}px` }}>
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold text-slate-500 shadow-[0_1px_0_rgba(226,232,240,1)]">
            <tr>
              {renderedColumns.map((column) => (
                <th key={column.id} className={`px-4 py-3 text-left ${COLUMN_WIDTHS[column.id] || ''}`}>
                  {column.sortKey ? (
                    <SortHeader sortKey={column.sortKey} sort={sort} onSort={onSort}>{column.label}</SortHeader>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const selected = selectedAssetId === asset.id;
              return (
                <tr
                  key={asset.id}
                  className={`cursor-pointer align-top transition ${selected ? 'bg-blue-50/80 shadow-[inset_3px_0_0_#2563eb]' : 'hover:bg-slate-50'}`}
                  onClick={() => onSelect(asset.id)}
                >
                  {renderedColumns.map((column) => (
                    <td key={column.id} className="border-b border-slate-100 px-4 py-3">
                      {renderAssetCell(asset, column.id)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailBlock({ icon: Icon, title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2.5 flex items-center gap-2 text-sm font-black text-slate-900">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className={`max-w-[62%] text-right text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {safeText(value)}
      </span>
    </div>
  );
}

function DetailMetric({ icon: Icon, label, value, tone = 'text-blue-600', mono = false }) {
  return (
    <div className="rounded-md bg-slate-50 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className={`mt-1 truncate text-sm font-black text-slate-950 ${mono ? 'font-mono' : ''}`}>
        {safeText(value)}
      </div>
    </div>
  );
}

function ReadinessItem({ label, value, ready }) {
  const Icon = ready ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`rounded-md border px-2.5 py-2 ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${ready ? 'text-emerald-600' : 'text-amber-600'}`} />
        <span className={`text-xs font-black ${ready ? 'text-emerald-800' : 'text-amber-800'}`}>{label}</span>
      </div>
      <div className={`mt-1 truncate text-xs font-semibold ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>
        {safeText(value)}
      </div>
    </div>
  );
}

function EmptyDetailNote({ children }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
      {children}
    </div>
  );
}

function getAssetReadiness(asset) {
  const hasCredential = asset.credential.status === 'active' && asset.credential.count > 0;
  const hasBackup = asset.backup.versionCount > 0 || asset.backup.status === 'ready';
  const hasAnsible = asset.automation.managed;

  return [
    { key: 'ip', label: '管理 IP', ready: !!asset.managementIp, value: asset.managementIp || '缺少管理地址' },
    { key: 'credential', label: '密码凭据', ready: hasCredential, value: hasCredential ? `${asset.credential.count} 条可用` : SECRET_LABELS[asset.credential.status] },
    { key: 'backup', label: '配置备份', ready: hasBackup, value: hasBackup ? `${asset.backup.versionCount} 个版本` : asset.backup.label },
    { key: 'ansible', label: 'Ansible', ready: hasAnsible, value: asset.automation.label },
  ];
}

function getInventoryGroups(asset) {
  return [
    asset.type ? `type_${inventoryToken(asset.type)}` : null,
    asset.datacenterName ? `dc_${inventoryToken(asset.datacenterName)}` : null,
    asset.rackCode ? `rack_${inventoryToken(asset.rackCode)}` : null,
  ].filter(Boolean);
}

function getAnsibleReadiness(asset) {
  return [
    { key: 'host', label: '管理地址', ready: !!asset.managementIp, value: asset.managementIp || '缺少 ansible_host' },
    { key: 'type', label: '设备类型', ready: asset.type !== 'unknown', value: asset.typeLabel || '未分类' },
    { key: 'credential', label: '登录凭据', ready: asset.credential.status === 'active' && asset.credential.count > 0, value: asset.credential.count ? `${asset.credential.count} 条` : '未绑定' },
    { key: 'inventory', label: 'Inventory', ready: asset.automation.managed, value: asset.automation.inventoryName || asset.name },
  ];
}

function buildInventoryPreview(asset) {
  const groups = getInventoryGroups(asset);
  const hostName = inventoryToken(asset.name, inventoryToken(asset.id, 'asset'));
  return [
    `[${groups[0] || 'unmanaged_assets'}]`,
    `${hostName} ansible_host=${asset.managementIp || '0.0.0.0'}`,
    '',
    `[${groups[0] || 'unmanaged_assets'}:vars]`,
    `device_type=${asset.type || 'unknown'}`,
    `credential_ref=${asset.credential.count > 0 ? `asset-${asset.id}` : 'missing'}`,
  ].join('\n');
}

function AssetDetail({ asset, onProvisionBackup, onRunBackup, backupActionAssetId }) {
  const [activeTab, setActiveTab] = useState('basic');

  if (!asset) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">
        请选择一台资产。
      </div>
    );
  }

  const readiness = getAssetReadiness(asset);
  const readyCount = readiness.filter((item) => item.ready).length;
  const readinessPercent = Math.round((readyCount / readiness.length) * 100);
  const inventoryGroups = getInventoryGroups(asset);
  const backupVersions = Array.isArray(asset.backup.versions) ? asset.backup.versions : [];
  const backupBusy = backupActionAssetId === asset.id;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-blue-700">Asset</div>
            <div className="mt-1 text-xl font-black text-slate-950">{asset.name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="bg-blue-50 text-blue-700 ring-blue-200">{asset.typeLabel}</Pill>
              <Pill tone={STATUS_TONES[asset.status] || STATUS_TONES.unknown}>{STATUS_LABELS[asset.status] || asset.status}</Pill>
              <Pill tone={readinessPercent >= 75 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                档案 {readinessPercent}%
              </Pill>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Server className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <DetailMetric icon={Network} label="管理 IP" value={asset.managementIp} mono />
          <DetailMetric icon={MapPin} label="位置" value={[asset.datacenterName, asset.rackCode].filter(Boolean).join(' / ')} tone="text-emerald-600" />
          <DetailMetric icon={Database} label="配置版本" value={`${asset.backup.versionCount} 个`} tone="text-amber-600" />
          <DetailMetric icon={Terminal} label="纳管状态" value={asset.automation.label} tone="text-blue-600" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {readiness.map((item) => (
            <ReadinessItem key={item.key} label={item.label} value={item.value} ready={item.ready} />
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-5 gap-1 border-b border-slate-200 bg-slate-50 p-2">
          {DETAIL_TABS.map(({ id, label, shortLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              title={label}
              className={`flex h-8 min-w-0 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-bold transition ${
                activeTab === id
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{shortLabel}</span>
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'basic' ? (
        <>
          <DetailBlock icon={MapPin} title="身份与位置">
            <InfoRow label="厂商" value={asset.vendor} />
            <InfoRow label="型号" value={asset.model} />
            <InfoRow label="系统版本" value={asset.osVersion} />
            <InfoRow label="序列号" value={asset.serialNumber} mono />
            <InfoRow label="资产编号" value={asset.assetTag} />
            <InfoRow label="机房" value={asset.datacenterName} />
            <InfoRow label="机柜位置" value={[asset.rackCode, asset.rackPosition].filter(Boolean).join(' / ')} />
          </DetailBlock>

          <DetailBlock icon={ShieldCheck} title="运维归属">
            <InfoRow label="项目" value={asset.project} />
            <InfoRow label="负责人" value={asset.contact} />
            <InfoRow label="数据来源" value={asset.source === 'device' ? '机房设备台账' : 'IP 地址台账'} />
            <InfoRow label="额定功率" value={asset.powerUsage ? `${asset.powerUsage} W` : ''} />
            <InfoRow label="典型功率" value={asset.typicalPower ? `${asset.typicalPower} W` : ''} />
          </DetailBlock>
        </>
      ) : null}

      {activeTab === 'backup' ? (
      <DetailBlock icon={Database} title="配置备份">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div className="text-xs font-black text-slate-700">系统内置备份</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {asset.backup.targetId
                ? `目标 #${asset.backup.targetId} / ${asset.backup.targetEnabled ? '已启用' : '已停用'} / ${asset.backup.targetCredentialName || '未绑定凭据'}`
                : '尚未创建备份目标'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!asset.backup.targetId ? (
              <button
                type="button"
                onClick={() => onProvisionBackup(asset)}
                disabled={backupBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Database className="h-3.5 w-3.5" />
                创建目标
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRunBackup(asset)}
                disabled={backupBusy || !asset.backup.targetEnabled}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${backupBusy ? 'animate-spin' : ''}`} />
                执行备份
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-md p-2.5 ${asset.backup.versionCount ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <div className={`text-xs font-semibold ${asset.backup.versionCount ? 'text-emerald-700' : 'text-amber-700'}`}>状态</div>
            <div className={`mt-1 text-sm font-black ${asset.backup.versionCount ? 'text-emerald-900' : 'text-amber-900'}`}>{asset.backup.label}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2.5">
            <div className="text-xs font-semibold text-slate-500">版本</div>
            <div className="mt-1 text-sm font-black text-slate-900">{asset.backup.versionCount}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2.5">
            <div className="text-xs font-semibold text-slate-500">最近</div>
            <div className="mt-1 text-sm font-black text-slate-900">{formatTime(asset.backup.lastBackupAt)}</div>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          最近配置版本：<span className="font-mono font-bold text-slate-700">{asset.backup.latestVersion || '-'}</span>；最近结果：{asset.backup.lastResult || '-'}。
        </div>
        <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
          <InfoRow label="备份类型目录" value={asset.backup.deviceType} />
          <InfoRow label="目标状态" value={asset.backup.targetStatusLabel || asset.backup.targetStatus} />
          <InfoRow label="最近文件路径" value={asset.backup.storagePath} mono />
        </div>
        {asset.backup.targetError ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            最近失败：{asset.backup.targetError}
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          <div className="text-xs font-black text-slate-700">版本列表</div>
          {backupVersions.length ? (
            backupVersions.slice(0, 5).map((version) => {
              const versionName = version.filename || version.name || version.relative_path || '配置版本';
              const versionTime = version.time_iso || version.finished_at || version.started_at || version.created_at || version.time;
              const versionLabel = version.status_label || CONFIG_BACKUP_STATUS_LABELS[version.status] || (version.status === 'failed' ? '失败' : '可用');
              return (
                <div key={version.id || version.relative_path || versionName} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-black text-slate-800">{versionName}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatTime(versionTime)}</div>
                  </div>
                  <Pill tone={version.status === 'failed' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
                    {versionLabel}
                  </Pill>
                </div>
              );
            })
          ) : (
            <EmptyDetailNote>暂无设备配置版本，当前设备还没有进入配置采集链路。</EmptyDetailNote>
          )}
        </div>
      </DetailBlock>
      ) : null}

      {activeTab === 'credential' ? (
      <DetailBlock icon={KeyRound} title="密码状态">
        <div className="flex items-center justify-between gap-3">
          <Pill tone={SECRET_TONES[asset.credential.status]}>{SECRET_LABELS[asset.credential.status]}</Pill>
          <span className="text-sm font-bold text-slate-800">{asset.credential.count} 条凭据</span>
        </div>
        {asset.credential.items.length ? (
          <div className="mt-3 space-y-2">
            {asset.credential.items.slice(0, 4).map((secret) => (
              <div key={secret.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-800">{secret.name}</span>
                  <Pill tone={SECRET_TONES[secret.lifecycle_status || secret.status || 'active']}>
                    {SECRET_LABELS[secret.lifecycle_status || secret.status || 'active'] || secret.status}
                  </Pill>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
                    <div className="text-slate-400">账号提示</div>
                    <div className="mt-0.5 truncate font-mono font-bold text-slate-700">{safeText(secret.username_hint)}</div>
                  </div>
                  <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
                    <div className="text-slate-400">责任团队</div>
                    <div className="mt-0.5 truncate font-bold text-slate-700">{safeText(secret.owner_team)}</div>
                  </div>
                  <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
                    <div className="text-slate-400">环境 / 类型</div>
                    <div className="mt-0.5 truncate font-bold text-slate-700">{safeText([secret.environment, secret.credential_type].filter(Boolean).join(' / '))}</div>
                  </div>
                  <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
                    <div className="text-slate-400">到期时间</div>
                    <div className="mt-0.5 truncate font-bold text-slate-700">{formatTime(secret.expires_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!asset.credential.items.length ? (
          <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            当前资产还没有绑定可用于登录或自动化的密码凭据。
          </div>
        ) : null}
      </DetailBlock>
      ) : null}

      {activeTab === 'ansible' ? (
      <DetailBlock icon={Terminal} title="自动化">
        <InfoRow label="Ansible" value={asset.automation.label} />
        <InfoRow label="Inventory" value={asset.automation.inventoryName} />
        <InfoRow label="分组" value={(asset.automation.groups.length ? asset.automation.groups : inventoryGroups).join(', ')} />
        <InfoRow label="最近任务" value={asset.automation.lastJobStatus} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {getAnsibleReadiness(asset).map((item) => (
            <ReadinessItem key={item.key} label={item.label} value={item.value} ready={item.ready} />
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-slate-950">
          <div className="border-b border-white/10 px-3 py-2 text-xs font-black text-slate-300">Inventory 预览</div>
          <pre className="overflow-x-auto p-3 text-xs leading-5 text-slate-100">{buildInventoryPreview(asset)}</pre>
        </div>
      </DetailBlock>
      ) : null}

      {activeTab === 'basic' ? (
      <DetailBlock icon={Network} title="关联 IP">
        {asset.relatedIps.length ? (
          <div className="space-y-2">
            {asset.relatedIps.map((ip) => (
              <div key={ip.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                <span className="font-mono text-sm font-bold text-slate-800">{ip.ip_address}</span>
                <Pill tone={STATUS_TONES[ip.status] || STATUS_TONES.unknown}>{STATUS_LABELS[ip.status] || ip.status || '未检测'}</Pill>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">暂无关联 IP。</div>
        )}
      </DetailBlock>
      ) : null}

      {activeTab === 'changes' ? (
        <DetailBlock icon={ClipboardList} title="变更记录">
          <div className="space-y-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">资产档案同步</span>
                <span className="text-xs text-slate-500">{formatTime(asset.updatedAt)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                由资产中心根据机房设备、IP、密码本数据聚合生成。后续可接入申请中心审批记录。
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">密码凭据状态</span>
                <Pill tone={SECRET_TONES[asset.credential.status]}>{SECRET_LABELS[asset.credential.status]}</Pill>
              </div>
              <div className="mt-1 text-xs text-slate-500">{asset.credential.count} 条凭据与该资产关联。</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">配置备份状态</span>
                <Pill tone={backupTone(asset.backup)}>{asset.backup.label}</Pill>
              </div>
              <div className="mt-1 text-xs text-slate-500">最近版本：{asset.backup.latestVersion || '-'}。</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">自动化纳管状态</span>
                <Pill tone={automationTone(asset.automation)}>{asset.automation.label}</Pill>
              </div>
              <div className="mt-1 text-xs text-slate-500">最近任务：{asset.automation.lastJobStatus || '-'}。</div>
            </div>
          </div>
        </DetailBlock>
      ) : null}
    </div>
  );
}

export default function AssetCenterView({
  datacenters = [],
  racks = [],
  rackDevices = [],
  ips = [],
  secrets = [],
  configBackups = null,
  dataErrors = {},
  isDataLoading = false,
  onRefresh,
}) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [risk, setRisk] = useState('all');
  const [credentialFilter, setCredentialFilter] = useState('all');
  const [backupFilter, setBackupFilter] = useState('all');
  const [automationFilter, setAutomationFilter] = useState('all');
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'risk', direction: 'desc' });
  const [backupActionAssetId, setBackupActionAssetId] = useState(null);
  const secretsLoaded = !dataErrors?.secrets;

  const assets = useMemo(
    () => buildAssets({ datacenters, racks, rackDevices, ips, secrets, configBackups, secretsLoaded }),
    [configBackups, datacenters, ips, rackDevices, racks, secrets, secretsLoaded],
  );

  const filteredAssets = useMemo(
    () => filterAssets(assets, {
      keyword,
      status,
      type,
      risk,
      credential: credentialFilter,
      backup: backupFilter,
      automation: automationFilter,
    }),
    [assets, automationFilter, backupFilter, credentialFilter, keyword, risk, status, type],
  );

  const sortedAssets = useMemo(
    () => sortAssets(filteredAssets, sortConfig),
    [filteredAssets, sortConfig],
  );

  const groupSummary = useMemo(
    () => buildGroupSummary(filteredAssets),
    [filteredAssets],
  );

  const selectedAsset = useMemo(() => {
    const preferred = sortedAssets.find((asset) => asset.id === selectedAssetId);
    return preferred || sortedAssets[0] || assets[0] || null;
  }, [assets, selectedAssetId, sortedAssets]);

  const sortOptionValue = `${sortConfig.key}:${sortConfig.direction}`;
  const hasPresetSortOption = SORT_OPTIONS.some((option) => option.value === sortOptionValue);
  const currentSortLabel = `${SORT_LABELS[sortConfig.key] || '排序'}${sortConfig.direction === 'asc' ? '升序' : '降序'}`;
  const sortDisplayLabel = SORT_OPTIONS.find((option) => option.value === sortOptionValue)?.label || currentSortLabel;

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: DEFAULT_SORT_DIRECTIONS[key] || 'asc' };
    });
  };

  const handleSortOptionChange = (event) => {
    const [key, direction] = event.target.value.split(':');
    setSortConfig({ key, direction });
  };

  const handleToggleColumn = (columnId) => {
    const column = COLUMN_DEFINITIONS.find((item) => item.id === columnId);
    if (!column || column.required) return;
    setVisibleColumns((current) => ({
      ...current,
      [columnId]: !current[columnId],
    }));
  };

  const refreshAssets = async () => {
    if (typeof onRefresh === 'function') {
      await onRefresh();
    }
  };

  const readApiError = async (response, fallback) => {
    const payload = await response.json().catch(() => ({}));
    return payload?.detail || payload?.message || fallback;
  };

  const handleProvisionBackup = async (asset) => {
    if (!asset?.managementIp) {
      window.alert('请先为该资产补充管理 IP。');
      return;
    }
    setBackupActionAssetId(asset.id);
    try {
      const response = await safeFetch('/api/config-backup-targets/provision/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: asset.name,
          management_ip: asset.managementIp,
          rack_device: asset.source === 'device' ? asset.deviceId : null,
          ip_address: asset.relatedIps[0]?.id || null,
          device_type: asset.type,
          command_profile: 'huawei_vrp',
        }),
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '创建配置备份目标失败。'));
        return;
      }
      await refreshAssets();
    } finally {
      setBackupActionAssetId(null);
    }
  };

  const handleRunBackup = async (asset) => {
    if (!asset?.backup?.targetId) {
      await handleProvisionBackup(asset);
      return;
    }
    setBackupActionAssetId(asset.id);
    try {
      const response = await safeFetch(`/api/config-backup-targets/${asset.backup.targetId}/run/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        window.alert(await readApiError(response, '执行配置备份失败。'));
      }
      await refreshAssets();
    } finally {
      setBackupActionAssetId(null);
    }
  };


  const typeOptions = useMemo(() => {
    const entries = new Map();
    assets.forEach((asset) => entries.set(asset.type, asset.typeLabel));
    return Array.from(entries.entries()).sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'));
  }, [assets]);

  const summary = useMemo(() => {
    const healthyStatuses = new Set(['active', 'online']);
    const offlineStatuses = new Set(['offline', 'unknown']);
    const credentialReady = assets.filter((asset) => asset.credential.status === 'active').length;
    const backupReady = assets.filter((asset) => asset.backup.versionCount > 0 || asset.backup.status === 'ready').length;
    const automationReady = assets.filter((asset) => asset.automation.managed).length;
    const riskAssets = assets.filter((asset) => asset.riskCodes.length > 0).length;
    return {
      total: assets.length,
      healthy: assets.filter((asset) => healthyStatuses.has(asset.status)).length,
      offline: assets.filter((asset) => offlineStatuses.has(asset.status)).length,
      credentialRate: assets.length ? Math.round((credentialReady / assets.length) * 100) : 0,
      backupRate: assets.length ? Math.round((backupReady / assets.length) * 100) : 0,
      automationRate: assets.length ? Math.round((automationReady / assets.length) * 100) : 0,
      riskAssets,
    };
  }, [assets]);

  return (
    <div className="h-full overflow-auto bg-slate-100 p-3 lg:p-4">
      <div className="mx-auto max-w-[1920px] space-y-3">
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              V2 Asset Center
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-950">资产中心</h1>
            <div className="mt-1 text-sm text-slate-500">设备、配置、密码、自动化的统一资产工作台</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isDataLoading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="刷新资产数据"
            >
              <RefreshCw className={`h-4 w-4 ${isDataLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </section>

        <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          <IconTile icon={HardDrive} label="资产总数" value={summary.total} subtext={`${filteredAssets.length} 条可见`} tone="text-blue-600" />
          <IconTile icon={CheckCircle2} label="在线运行" value={summary.healthy} subtext={`${summary.offline} 条离线或未检测`} tone="text-emerald-600" />
          <IconTile icon={Database} label="配置备份" value={`${summary.backupRate}%`} subtext="设备配置采集" tone="text-amber-600" />
          <IconTile icon={KeyRound} label="密码受控" value={`${summary.credentialRate}%`} subtext={dataErrors?.secrets ? '无权限或加载失败' : '按绑定凭据统计'} tone="text-violet-600" />
          <IconTile icon={Terminal} label="自动化纳管" value={`${summary.automationRate}%`} subtext="Ansible Inventory" tone="text-blue-600" />
          <IconTile icon={AlertTriangle} label="风险资产" value={summary.riskAssets} subtext="按当前资产状态计算" tone="text-rose-600" />
        </section>

        <section className="sticky top-0 z-20 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2 xl:grid-cols-[minmax(280px,1.1fr)_minmax(0,2fr)]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="搜索名称、IP、序列号、项目、负责人"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[repeat(7,minmax(120px,1fr))_90px]">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">全部状态</option>
                <option value="active">运行中</option>
                <option value="online">在线</option>
                <option value="offline">离线</option>
                <option value="maintenance">维护中</option>
                <option value="planned">规划中</option>
                <option value="retired">已退役</option>
                <option value="unknown">未检测</option>
              </select>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">全部类型</option>
                {typeOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={risk}
                onChange={(event) => setRisk(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">全部风险</option>
                <option value="offline">不可达</option>
                <option value="credential">密码未受控</option>
                <option value="backup">配置未接入</option>
                <option value="automation">未纳管</option>
              </select>
              <select
                value={credentialFilter}
                onChange={(event) => setCredentialFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">全部密码</option>
                <option value="active">已受控</option>
                <option value="missing">未绑定</option>
                <option value="expiring">即将过期</option>
                <option value="expired">已过期</option>
                <option value="disabled">已停用</option>
                <option value="unavailable">未加载</option>
              </select>
              <select
                value={backupFilter}
                onChange={(event) => setBackupFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">全部备份</option>
                <option value="ready">已接入</option>
                <option value="missing">未接入</option>
                <option value="pending">待接入</option>
                <option value="failed">失败</option>
              </select>
              <select
                value={automationFilter}
                onChange={(event) => setAutomationFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">全部纳管</option>
                <option value="managed">已纳管</option>
                <option value="unmanaged">未纳管</option>
              </select>
              <select
                value={sortOptionValue}
                onChange={handleSortOptionChange}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                title="排序方式"
              >
                {hasPresetSortOption ? null : <option value={sortOptionValue}>{currentSortLabel}</option>}
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
                <Filter className="h-4 w-4 text-slate-400" />
                {filteredAssets.length}
              </div>
            </div>
          </div>
        </section>

        <GroupSummary summary={groupSummary} total={filteredAssets.length} />

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <AssetTable
            assets={sortedAssets}
            selectedAssetId={selectedAsset?.id}
            onSelect={setSelectedAssetId}
            sort={sortConfig}
            onSort={handleSort}
            sortLabel={sortDisplayLabel}
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
          />
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <AssetDetail
              asset={selectedAsset}
              onProvisionBackup={handleProvisionBackup}
              onRunBackup={handleRunBackup}
              backupActionAssetId={backupActionAssetId}
            />
          </aside>
        </section>
      </div>
    </div>
  );
}
