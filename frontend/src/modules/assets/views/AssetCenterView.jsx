import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Boxes,
  Cable,
  CheckCircle2,
  ChevronDown,
  Columns3,
  ClipboardList,
  Cpu,
  Database,
  Filter,
  GitBranch,
  Globe2,
  HardDrive,
  KeyRound,
  Link2,
  MapPin,
  Network,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Router,
  Save,
  Search,
  Server,
  ServerCog,
  Settings2,
  Shield,
  ShieldCheck,
  Terminal,
  Video,
  Wifi,
  X,
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

const extractManagementHost = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const urlText = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `ssh://${text}`;
    const parsed = new URL(urlText);
    return parsed.hostname || text;
  } catch (error) {
    return text
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  }
};

const normalizeActionMessage = (message, fallback = '操作失败。') => {
  const text = safeText(message, fallback);
  if (/incompatible ssh peer|no acceptable kex|no matching|unable to agree|kex algorithm/i.test(text)) {
    return 'SSH 算法协商失败：设备只支持较旧的 KEX/HostKey/Cipher 算法。系统已启用旧 SSH 兼容尝试，如果仍失败，请在设备侧启用 diffie-hellman-group14-sha1 / group1-sha1 或升级设备 SSH 算法。';
  }
  return text;
};

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
  load_balancer: '负载均衡',
  waf: 'WAF',
  ids: 'IDS/IPS',
  ips: 'IDS/IPS',
  wireless_controller: '无线控制器',
  ap: '无线 AP',
  storage: '存储',
  storage_device: '存储',
  security: '安全设备',
  video_conference: '会议/视频设备',
  gateway: '网关',
  ups: 'UPS',
  pdu: 'PDU',
  odf: 'ODF',
  pc: '终端',
  printer: '打印机',
  other: '其他设备',
  unknown: '未分类',
};

const CANONICAL_DEVICE_TYPES = [
  { key: 'firewall', label: DEVICE_TYPE_LABELS.firewall, group: 'network', keywords: ['firewall', 'fw', '防火墙', '出口墙'] },
  { key: 'switch_core', label: DEVICE_TYPE_LABELS.switch_core, group: 'network', keywords: ['switch_core', 'core switch', '核心交换', '核心交换机', '汇聚交换', '内网核心交换'] },
  { key: 'switch_access', label: DEVICE_TYPE_LABELS.switch_access, group: 'network', keywords: ['switch_access', 'access switch', '接入交换', '接入交换机'] },
  { key: 'switch', label: DEVICE_TYPE_LABELS.switch, group: 'network', keywords: ['switch', '交换机', '交换'] },
  { key: 'router', label: DEVICE_TYPE_LABELS.router, group: 'network', keywords: ['router', 'route', '路由器', '路由'] },
  { key: 'load_balancer', label: DEVICE_TYPE_LABELS.load_balancer, group: 'network', keywords: ['load_balancer', 'load balancer', '负载均衡', 'slb', 'f5'] },
  { key: 'waf', label: DEVICE_TYPE_LABELS.waf, group: 'security', keywords: ['waf', 'web应用防火墙'] },
  { key: 'ids', label: DEVICE_TYPE_LABELS.ids, group: 'security', keywords: ['ids', 'ips', '入侵检测', '入侵防御'] },
  { key: 'wireless_controller', label: DEVICE_TYPE_LABELS.wireless_controller, group: 'network', keywords: ['wireless_controller', '无线控制器', '无线ac', 'wlc'] },
  { key: 'ap', label: DEVICE_TYPE_LABELS.ap, group: 'network', keywords: ['wireless ap', '无线ap'] },
  { key: 'video_conference', label: DEVICE_TYPE_LABELS.video_conference, group: 'collaboration', keywords: ['视频会商', '视频会议', '会商', '会议终端', '媒体融合', 'polycom', 'kedacom', 'mcu', 'smc'] },
  { key: 'server', label: DEVICE_TYPE_LABELS.server, group: 'compute', keywords: ['server', '服务器'] },
  { key: 'vm', label: DEVICE_TYPE_LABELS.vm, group: 'compute', keywords: ['vm', '虚拟机'] },
  { key: 'storage', label: DEVICE_TYPE_LABELS.storage, group: 'storage', keywords: ['storage', '存储', '磁盘阵列'] },
  { key: 'security', label: DEVICE_TYPE_LABELS.security, group: 'security', keywords: ['security', '安全设备', '安全网关', '网闸'] },
  { key: 'gateway', label: DEVICE_TYPE_LABELS.gateway, group: 'network', keywords: ['gateway', '网关'] },
  { key: 'odf', label: DEVICE_TYPE_LABELS.odf, group: 'passive', keywords: ['odf', '配线架', '配线'] },
  { key: 'ups', label: DEVICE_TYPE_LABELS.ups, group: 'facility', keywords: ['ups'] },
  { key: 'pdu', label: DEVICE_TYPE_LABELS.pdu, group: 'facility', keywords: ['pdu'] },
];

const CANONICAL_DEVICE_TYPE_MAP = new Map(
  CANONICAL_DEVICE_TYPES.map((item) => [item.key, item]),
);

const DEVICE_TYPE_OPTION_ORDER = new Map(
  CANONICAL_DEVICE_TYPES.map((item, index) => [item.key, index]),
);

const TYPE_TEXT_ALIASES = {
  storage_device: 'storage',
  meeting_device: 'video_conference',
  video_gateway: 'video_conference',
};

const LOW_PRIORITY_TYPE_KEYS = new Set(['odf', 'ups', 'pdu', 'gateway', 'storage', 'security', 'server']);

const normalizeTypeText = (value) => normalize(value).replace(/[\s_\-\\/]+/g, '');

function classifyAssetType(rawType, name = '') {
  const rawKey = normalize(rawType);
  const aliasedKey = TYPE_TEXT_ALIASES[rawKey] || rawKey;
  if (CANONICAL_DEVICE_TYPE_MAP.has(aliasedKey)) {
    return CANONICAL_DEVICE_TYPE_MAP.get(aliasedKey);
  }

  const text = normalizeTypeText(`${rawType || ''} ${name || ''}`);
  const matched = CANONICAL_DEVICE_TYPES.find((item) =>
    !LOW_PRIORITY_TYPE_KEYS.has(item.key)
    && item.keywords.some((keyword) => text.includes(normalizeTypeText(keyword))),
  );
  if (matched) return matched;

  const secondaryMatched = CANONICAL_DEVICE_TYPES.find((item) =>
    item.keywords.some((keyword) => text.includes(normalizeTypeText(keyword))),
  );
  if (secondaryMatched) return secondaryMatched;

  if (!rawType && !name) {
    return { key: 'unknown', label: DEVICE_TYPE_LABELS.unknown, group: 'unknown' };
  }
  return { key: 'other', label: DEVICE_TYPE_LABELS.other, group: 'other' };
}

const ASSET_CENTER_INCLUDED_TYPES = new Set([
  'server',
  'vm',
  'switch_core',
  'switch_access',
  'switch',
  'router',
  'firewall',
  'load_balancer',
  'waf',
  'ids',
  'ips',
  'wireless_controller',
  'ap',
  'storage',
  'storage_device',
  'security',
  'video_conference',
  'gateway',
]);

const ASSET_CENTER_EXCLUDED_TYPES = new Set([
  'pc',
  'printer',
  'terminal',
  'desktop',
  'laptop',
  'computer',
  'client',
  'endpoint',
  'camera',
  'phone',
  'mobile',
  'tablet',
  'other',
  'unknown',
]);

const INFRASTRUCTURE_TYPE_KEYWORDS = [
  '服务器',
  'server',
  '虚拟机',
  '交换机',
  'switch',
  '路由',
  'router',
  '防火墙',
  'firewall',
  '安全',
  'security',
  '存储',
  'storage',
  '负载',
  'load balancer',
  '网关',
  'gateway',
  'waf',
  'vpn',
  '无线控制器',
  'ap',
];

const ENDPOINT_TYPE_KEYWORDS = [
  '电脑',
  '终端',
  'pc',
  'desktop',
  'laptop',
  '笔记本',
  '打印',
  'printer',
  '摄像',
  'camera',
  '手机',
  'phone',
  '平板',
  'tablet',
  '客户端',
  '办公',
];

function isAssetCenterInfrastructure(record = {}) {
  const rawType = normalize(record.device_type || record.type);
  const typeInfo = classifyAssetType(record.device_type || record.type, record.name || record.device_name);
  const label = normalize(typeInfo.label || DEVICE_TYPE_LABELS[record.device_type] || record.device_type || record.type || '');
  const name = normalize(record.name || record.device_name || '');
  const text = `${rawType} ${label} ${name}`;
  if (ASSET_CENTER_INCLUDED_TYPES.has(rawType)) return true;
  if (ASSET_CENTER_EXCLUDED_TYPES.has(rawType) && !['other', 'unknown'].includes(rawType)) return false;
  if (ENDPOINT_TYPE_KEYWORDS.some((keyword) => text.includes(normalize(keyword)))) return false;
  if (['network', 'security', 'compute', 'storage', 'collaboration'].includes(typeInfo.group)) return true;
  return INFRASTRUCTURE_TYPE_KEYWORDS.some((keyword) => text.includes(normalize(keyword)));
}

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

const GOVERNANCE_LABELS = {
  all: '全部治理',
  type_review: '分类待确认',
  missing_ip: '缺管理 IP',
  missing_location: '缺机房位置',
  missing_credential: '缺密码凭据',
  missing_backup: '缺备份目标',
  backup_ready: '可纳入备份',
  ansible_ready: '可纳入自动化',
};

const GOVERNANCE_DESCRIPTIONS = {
  type_review: '类型过于笼统或疑似识别错误，优先把它归到防火墙、交换机、服务器等标准类目。',
  missing_ip: '没有可用管理地址，后续密码、备份和自动化都无法顺畅接入。',
  missing_location: '缺少机房或机柜位置，会影响容量统计和责任定位。',
  missing_credential: '没有绑定可用凭据，无法做登录测试、配置备份和 Ansible 纳管。',
  missing_backup: '还没有可用配置版本或备份目标，配置风险不可追溯。',
  backup_ready: '已经具备管理 IP 和密码，可以批量转为配置备份目标。',
  ansible_ready: '已经具备管理 IP 和密码，可以进入 Ansible Inventory 纳管。',
};

const GENERIC_TYPE_KEYS = new Set(['other', 'unknown', 'security', 'server']);
const NETWORK_NAME_HINTS = ['交换机', '核心交换', '接入交换', '路由器', '防火墙', '网关', '无线AC', '无线 AP', '无线AP', '控制器', 'WAF', 'IDS', 'IPS', 'VPN', '出口'];

const CONFIG_BACKUP_STATUS_LABELS = {
  not_run: '未执行',
  running: '执行中',
  success: '成功',
  failed: '失败',
  disabled: '已停用',
};

const COMMAND_PROFILE_OPTIONS = [
  { value: 'huawei_vrp', label: '华为 / H3C VRP' },
  { value: 'h3c_comware', label: 'H3C Comware' },
  { value: 'cisco_ios', label: 'Cisco IOS' },
  { value: 'generic_show_run', label: '通用 show running-config' },
];

const COMMAND_PROFILE_LABELS = Object.fromEntries(COMMAND_PROFILE_OPTIONS.map((item) => [item.value, item.label]));

const createCredentialForm = (asset, secret = null) => ({
  id: secret?.id || null,
  name: secret?.name || `${asset?.name || '设备'} SSH 登录`,
  secret_username: secret?.username_hint || '',
  secret_value: '',
  owner_team: secret?.owner_team || asset?.project || '',
  environment: secret?.environment || 'production',
  sensitivity: secret?.sensitivity || 'confidential',
  rotation_days: secret?.rotation_days || 90,
  notes: secret?.notes || '',
});

const createBackupTargetForm = (asset) => ({
  command_profile: asset?.backup?.targetCommandProfile || 'huawei_vrp',
  ssh_port: asset?.backup?.targetSshPort || 22,
  timeout_seconds: asset?.backup?.targetTimeoutSeconds || 30,
  save_before_backup: asset?.backup?.targetSaveBeforeBackup ?? true,
  retention_count: asset?.backup?.targetRetentionCount || 1,
  credential: asset?.backup?.targetCredentialId || asset?.credential?.items?.[0]?.id || '',
});

function Pill({ children, tone = 'bg-slate-100 text-slate-700 ring-slate-200' }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, label, value, tone = 'text-slate-700', subtext }) {
  return (
    <div className="asset-metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black leading-none text-slate-950">{value}</div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">{subtext}</div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
      </div>
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

function buildAutomationState(asset, backup, credential) {
  const hasCredential = credential.status === 'active' && credential.count > 0;
  const managed = Boolean(asset.managementIp && backup.targetId && backup.targetEnabled && (backup.targetCredentialId || hasCredential));
  const groups = [
    managed ? 'managed' : 'unmanaged',
    asset.datacenterName ? `dc_${inventoryToken(asset.datacenterName)}` : null,
    asset.type ? `type_${inventoryToken(asset.type)}` : null,
    asset.vendor ? `vendor_${inventoryToken(asset.vendor)}` : null,
  ].filter(Boolean);

  return {
    managed,
    label: managed ? '已纳管' : backup.targetId ? '待绑定凭据' : '未纳管',
    inventoryName: asset.managementIp || asset.name || '',
    groups,
    lastJobStatus: backup.targetStatusLabel || backup.lastResult || '未执行',
    targetId: backup.targetId,
    sshPort: backup.targetSshPort || 22,
    commandProfile: backup.targetCommandProfile || 'huawei_vrp',
  };
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
        targetCredentialId: target?.credential || null,
        targetCredentialName: target?.credential_name || '',
        targetCommandProfile: target?.command_profile || 'huawei_vrp',
        targetSshPort: target?.ssh_port || 22,
        targetTimeoutSeconds: target?.timeout_seconds || 30,
        targetSaveBeforeBackup: target?.save_before_backup ?? true,
        targetRetentionCount: target?.retention_count || 1,
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
      targetCredentialId: target?.credential || null,
      targetCredentialName: target?.credential_name || '',
      targetCommandProfile: target?.command_profile || 'huawei_vrp',
      targetSshPort: target?.ssh_port || 22,
      targetTimeoutSeconds: target?.timeout_seconds || 30,
      targetSaveBeforeBackup: target?.save_before_backup ?? true,
      targetRetentionCount: target?.retention_count || 1,
      targetError: target?.last_error || '',
    };
  };

  const deviceAssets = asArray(rackDevices).filter(isAssetCenterInfrastructure).map((device) => {
    usedDeviceKeys.add(normalize(device.name));
    const rack = rackMap.get(String(device.rack));
    const datacenter = rack ? datacenterMap.get(String(rack.datacenter)) : null;
    const relatedIps = findIpsForDevice(device);
    const assetIpIds = new Set(relatedIps.map((ip) => String(ip.id)));
    const credential = getSecretState(assetIpIds, device.id);
    const status = device.status || 'unknown';
    const managementIp = device.mgmt_ip || relatedIps[0]?.ip_address || '';
    const backup = getConfigBackupState(managementIp);
    const assetName = safeText(device.name, `Device ${device.id}`);
    const assetTypeInfo = classifyAssetType(device.device_type, assetName);
    const assetType = assetTypeInfo.key;
    const assetVendor = device.brand || '';
    const automation = buildAutomationState(
      {
        name: assetName,
        managementIp,
        type: assetType,
        vendor: assetVendor,
        datacenterName: datacenter?.name || '',
      },
      backup,
      credential,
    );
    const riskCodes = [];
    if (['offline', 'unknown'].includes(status)) riskCodes.push('offline');
    if (credential.status === 'missing') riskCodes.push('credential');
    if (backup.versionCount === 0 && backup.status !== 'ready') riskCodes.push('backup');
    if (!automation.managed) riskCodes.push('automation');

    return {
      id: `device-${device.id}`,
      source: 'device',
      deviceId: device.id,
      name: assetName,
      type: assetType,
      rawType: device.device_type || '',
      typeLabel: assetTypeInfo.label,
      typeGroup: assetTypeInfo.group,
      vendor: assetVendor,
      model: device.model || '',
      hostname: device.hostname || '',
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
      automation,
      riskCodes,
      updatedAt: device.updated_at || device.created_at || '',
    };
  });

  const ipOnlyAssets = ipList
    .filter((ip) => (
      ip.device_name
      && isAssetCenterInfrastructure(ip)
      && !usedIpIds.has(String(ip.id))
      && !usedDeviceKeys.has(normalize(ip.device_name))
    ))
    .map((ip) => {
      const assetIpIds = new Set([String(ip.id)]);
      const credential = getSecretState(assetIpIds, null);
      const status = ip.status || 'unknown';
      const backup = getConfigBackupState(ip.ip_address);
      const assetName = safeText(ip.device_name, ip.ip_address);
      const assetTypeInfo = classifyAssetType(ip.device_type, assetName);
      const assetType = assetTypeInfo.key;
      const automation = buildAutomationState(
        {
          name: assetName,
          managementIp: ip.ip_address || '',
          type: assetType,
          vendor: '',
          datacenterName: '',
        },
        backup,
        credential,
      );
      const riskCodes = [];
      if (['offline', 'unknown'].includes(status)) riskCodes.push('offline');
      if (credential.status === 'missing') riskCodes.push('credential');
      if (backup.versionCount === 0 && backup.status !== 'ready') riskCodes.push('backup');
      if (!automation.managed) riskCodes.push('automation');

      return {
        id: `ip-${ip.id}`,
        source: 'ip',
        deviceId: null,
        name: assetName,
        type: assetType,
        rawType: ip.device_type || '',
        typeLabel: assetTypeInfo.label,
        typeGroup: assetTypeInfo.group,
        vendor: '',
        model: '',
        hostname: ip.hostname || '',
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
        automation,
        riskCodes,
        updatedAt: ip.last_online || '',
      };
    });

  return [...deviceAssets, ...ipOnlyAssets].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function filterAssets(assets, filters) {
  const keyword = normalize(filters.keyword);
  return assets.filter((asset) => {
    if (filters.scope === 'priority' && !isPriorityManagedAsset(asset)) return false;
    if (filters.status !== 'all' && asset.status !== filters.status) return false;
    if (filters.type !== 'all' && asset.type !== filters.type) return false;
    if (filters.datacenter !== 'all' && (asset.datacenterName || '未标注机房') !== filters.datacenter) return false;
    if (filters.risk !== 'all' && !asset.riskCodes.includes(filters.risk)) return false;
    if (filters.credential !== 'all' && asset.credential.status !== filters.credential) return false;
    if (filters.backup !== 'all') {
      const backedUp = asset.backup.versionCount > 0 || asset.backup.status === 'ready';
      const targetStatus = asset.backup.targetStatus || asset.backup.status;
      if (filters.backup === 'ready' && !backedUp) return false;
      if (filters.backup === 'missing' && backedUp) return false;
      if (filters.backup === 'failed' && targetStatus !== 'failed') return false;
      if (filters.backup === 'pending' && !['pending', 'not_run'].includes(targetStatus) && asset.backup.status !== 'pending') return false;
      if (!['ready', 'missing', 'failed', 'pending'].includes(filters.backup) && asset.backup.status !== filters.backup) return false;
    }
    if (filters.automation !== 'all') {
      if (filters.automation === 'managed' && !asset.automation.managed) return false;
      if (filters.automation === 'unmanaged' && asset.automation.managed) return false;
    }
    if (filters.governance && filters.governance !== 'all' && !getAssetGovernanceFlags(asset).includes(filters.governance)) return false;
    if (!keyword) return true;
    return [
      asset.name,
      asset.hostname,
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

function suggestGovernanceType(asset) {
  const byName = classifyAssetType('', `${asset.name || ''} ${asset.specs || ''} ${asset.vendor || ''}`);
  if (byName.key && !['other', 'unknown'].includes(byName.key) && byName.key !== asset.type) return byName;
  const byRaw = classifyAssetType(asset.rawType || asset.type, asset.name || '');
  if (byRaw.key && !['other', 'unknown'].includes(byRaw.key)) return byRaw;
  return null;
}

function assetNeedsTypeReview(asset) {
  const rawType = normalize(asset.rawType || asset.type);
  const text = `${asset.name || ''} ${asset.typeLabel || ''} ${asset.specs || ''}`.toUpperCase();
  const networkLike = NETWORK_NAME_HINTS.some((hint) => text.includes(String(hint).toUpperCase()));
  if (['other', 'unknown'].includes(asset.type)) return true;
  if (!rawType && asset.source === 'ip') return true;
  if (asset.type === 'security') return true;
  if (asset.type === 'server' && networkLike) return true;
  if (GENERIC_TYPE_KEYS.has(asset.type) && networkLike) return true;
  return false;
}

function getAssetGovernanceFlags(asset) {
  const hasManagementIp = !!extractManagementHost(asset.managementIp);
  const hasLocation = !!asset.datacenterName && !!asset.rackCode;
  const hasCredential = asset.credential.status === 'active' && asset.credential.count > 0;
  const hasBackup = asset.backup.versionCount > 0 || asset.backup.status === 'ready';
  const flags = [];

  if (assetNeedsTypeReview(asset)) flags.push('type_review');
  if (!hasManagementIp) flags.push('missing_ip');
  if (!hasLocation) flags.push('missing_location');
  if (!hasCredential) flags.push('missing_credential');
  if (!hasBackup) flags.push('missing_backup');
  if (hasManagementIp && hasCredential && !hasBackup) flags.push('backup_ready');
  if (hasManagementIp && hasCredential && !asset.automation.managed) flags.push('ansible_ready');

  return flags;
}

function buildAssetGovernance(assets) {
  const counters = Object.fromEntries(
    Object.keys(GOVERNANCE_LABELS)
      .filter((key) => key !== 'all')
      .map((key) => [key, 0]),
  );
  const reviewAssets = [];

  assets.forEach((asset) => {
    const flags = getAssetGovernanceFlags(asset);
    flags.forEach((flag) => {
      counters[flag] = (counters[flag] || 0) + 1;
    });
    if (flags.length) {
      reviewAssets.push({
        asset,
        flags,
        score:
          (flags.includes('type_review') ? 40 : 0)
          + (flags.includes('missing_ip') ? 28 : 0)
          + (flags.includes('missing_credential') ? 22 : 0)
          + (flags.includes('missing_backup') ? 18 : 0)
          + (flags.includes('missing_location') ? 12 : 0)
          + asset.riskCodes.length * 8,
        suggestedType: suggestGovernanceType(asset),
      });
    }
  });

  const normalized = assets.length || 1;
  return {
    counters,
    reviewAssets: reviewAssets
      .sort((left, right) => right.score - left.score || left.asset.name.localeCompare(right.asset.name, 'zh-CN'))
      .slice(0, 8),
    qualityScore: Math.max(0, Math.round(100 - ((counters.type_review + counters.missing_ip + counters.missing_credential + counters.missing_backup) / normalized) * 24)),
    readyForBackup: counters.backup_ready || 0,
    readyForAnsible: counters.ansible_ready || 0,
  };
}

function getBackupTimestamp(asset) {
  const raw = asset?.backup?.lastBackupAt || asset?.updatedAt || '';
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function hasManagedBackupTarget(asset) {
  return !!asset?.backup?.targetId || !!asset?.backup?.target;
}

function hasActiveCredential(asset) {
  return asset?.credential?.status === 'active' && asset?.credential?.count > 0;
}

function isPriorityManagedAsset(asset) {
  return !!extractManagementHost(asset?.managementIp) && hasActiveCredential(asset) && hasManagedBackupTarget(asset);
}

function isBackupSuccessful(asset) {
  return asset?.backup?.targetStatus === 'success'
    || asset?.backup?.versionCount > 0
    || asset?.backup?.status === 'ready';
}

function buildPriorityWorkspace(assets) {
  const priorityAssets = assets.filter(isPriorityManagedAsset);
  const successAssets = priorityAssets.filter(isBackupSuccessful);
  const failedAssets = priorityAssets.filter((asset) => asset.backup.targetStatus === 'failed');
  const pendingAssets = priorityAssets.filter((asset) => !isBackupSuccessful(asset) && asset.backup.targetStatus !== 'failed');
  const ansibleReadyAssets = priorityAssets.filter((asset) => asset.automation.managed || isBackupSuccessful(asset));
  const typeGroups = countBy(priorityAssets, (asset) => asset.typeLabel || '未分类').slice(0, 6);
  const locationGroups = countBy(priorityAssets, (asset) => asset.datacenterName || '未标注机房').slice(0, 6);
  const recentAssets = [...priorityAssets]
    .sort((left, right) => getBackupTimestamp(right) - getBackupTimestamp(left))
    .slice(0, 6);
  const failureAssets = [...failedAssets]
    .sort((left, right) => getBackupTimestamp(right) - getBackupTimestamp(left))
    .slice(0, 6);

  return {
    total: priorityAssets.length,
    success: successAssets.length,
    failed: failedAssets.length,
    pending: pendingAssets.length,
    ansibleReady: ansibleReadyAssets.length,
    successRate: priorityAssets.length ? Math.round((successAssets.length / priorityAssets.length) * 100) : 0,
    typeGroups,
    locationGroups,
    recentAssets,
    failureAssets,
  };
}

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

function buildOverviewTypeCards(assets, typeOptions) {
  const preferredTypes = [
    'firewall',
    'switch_core',
    'switch_access',
    'switch',
    'router',
    'security',
    'server',
    'video_conference',
  ];
  const available = new Map(typeOptions.map(([key, label]) => [key, label]));
  preferredTypes.forEach((key) => {
    if (!available.has(key) && DEVICE_TYPE_LABELS[key]) available.set(key, DEVICE_TYPE_LABELS[key]);
  });
  return Array.from(available.entries())
    .map(([key, label]) => {
      const scopedAssets = assets.filter((asset) => asset.type === key);
      return {
        key,
        label,
        count: scopedAssets.length,
        online: scopedAssets.filter((asset) => ['active', 'online'].includes(asset.status)).length,
        risk: scopedAssets.filter((asset) => asset.riskCodes.length > 0).length,
      };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => {
      const leftOrder = preferredTypes.indexOf(left.key);
      const rightOrder = preferredTypes.indexOf(right.key);
      const normalizedLeft = leftOrder === -1 ? 999 : leftOrder;
      const normalizedRight = rightOrder === -1 ? 999 : rightOrder;
      return normalizedLeft - normalizedRight || right.count - left.count;
    })
    .slice(0, 10);
}

const TYPE_CARD_VISUALS = {
  firewall: { icon: Shield, tone: 'rose' },
  switch_core: { icon: GitBranch, tone: 'blue' },
  switch_access: { icon: Network, tone: 'cyan' },
  switch: { icon: Cable, tone: 'sky' },
  router: { icon: Router, tone: 'indigo' },
  load_balancer: { icon: GitBranch, tone: 'violet' },
  waf: { icon: ShieldCheck, tone: 'rose' },
  ids: { icon: ShieldCheck, tone: 'amber' },
  ips: { icon: ShieldCheck, tone: 'amber' },
  wireless_controller: { icon: RadioTower, tone: 'emerald' },
  ap: { icon: Wifi, tone: 'emerald' },
  video_conference: { icon: Video, tone: 'purple' },
  server: { icon: ServerCog, tone: 'slate' },
  vm: { icon: Cpu, tone: 'slate' },
  storage: { icon: Database, tone: 'amber' },
  security: { icon: ShieldCheck, tone: 'rose' },
  gateway: { icon: Globe2, tone: 'indigo' },
  odf: { icon: Boxes, tone: 'cyan' },
};

const getTypeCardVisual = (key) => TYPE_CARD_VISUALS[key] || { icon: HardDrive, tone: 'slate' };

function AssetGovernancePanel({ governance, onNavigate }) {
  const governanceCards = [
    { key: 'type_review', icon: ShieldCheck, tone: 'cyan' },
    { key: 'missing_ip', icon: Network, tone: 'amber' },
    { key: 'missing_credential', icon: KeyRound, tone: 'rose' },
    { key: 'backup_ready', icon: Database, tone: 'blue' },
    { key: 'ansible_ready', icon: Terminal, tone: 'violet' },
  ];

  return (
    <section className="asset-governance-panel">
      <div className="asset-governance-head">
        <div>
          <div className="ui-eyebrow text-xs font-black uppercase">Data Governance</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">资产数据治理 v1.3</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            先把分类、管理 IP、机房位置、密码和备份状态打干净，再推进批量备份和自动化纳管。
          </p>
        </div>
        <div className="asset-governance-score">
          <span className="text-xs font-black text-slate-500">治理健康度</span>
          <strong>{governance.qualityScore}</strong>
          <span className="text-xs font-semibold text-slate-500">越高代表资产基础越可用</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          {governanceCards.map(({ key, icon: Icon, tone }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate({ governance: key })}
              className={`asset-governance-card asset-governance-card--${tone}`}
            >
              <span className="asset-governance-icon">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-950">{GOVERNANCE_LABELS[key]}</span>
                <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-slate-500">
                  {GOVERNANCE_DESCRIPTIONS[key]}
                </span>
              </span>
              <strong>{governance.counters[key] || 0}</strong>
            </button>
          ))}
        </div>

        <div className="asset-governance-queue">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-black text-slate-950">优先治理队列</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">按分类、地址、凭据、备份缺口自动排序。</div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ governance: 'type_review' })}
              className="ui-secondary-button h-9 px-3 text-xs font-black"
            >
              待确认分类
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {governance.reviewAssets.length ? governance.reviewAssets.map(({ asset, flags, suggestedType }) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onNavigate({ governance: flags[0], keyword: asset.name })}
                className="asset-governance-row"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-950">{asset.name}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                    {asset.typeLabel}
                    {suggestedType?.label && suggestedType.key !== asset.type ? ` → 建议 ${suggestedType.label}` : ''}
                  </span>
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {flags.slice(0, 3).map((flag) => (
                    <span key={flag} className="asset-governance-tag">{GOVERNANCE_LABELS[flag]}</span>
                  ))}
                </span>
              </button>
            )) : (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-5 text-sm font-bold text-emerald-100">
                当前没有明显治理缺口，可以进入批量备份或 Ansible 纳管。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PriorityWorkspacePanel({ workspace, onNavigate }) {
  const metrics = [
    {
      label: '重点设备',
      value: workspace.total,
      subtext: '有 IP / 凭据 / 备份目标',
      icon: ServerCog,
      tone: 'cyan',
      criteria: { scope: 'priority' },
    },
    {
      label: '备份成功',
      value: workspace.success,
      subtext: `${workspace.successRate}% 已形成版本`,
      icon: CheckCircle2,
      tone: 'emerald',
      criteria: { scope: 'priority', backup: 'ready' },
    },
    {
      label: '备份失败',
      value: workspace.failed,
      subtext: '需要优先排查',
      icon: AlertTriangle,
      tone: 'rose',
      criteria: { scope: 'priority', backup: 'failed' },
    },
    {
      label: '待执行',
      value: workspace.pending,
      subtext: '已接入但暂无成功版本',
      icon: Database,
      tone: 'amber',
      criteria: { scope: 'priority', backup: 'pending' },
    },
    {
      label: 'Ansible 就绪',
      value: workspace.ansibleReady,
      subtext: '可转 Inventory',
      icon: Terminal,
      tone: 'violet',
      criteria: { scope: 'priority', governance: 'ansible_ready' },
    },
  ];

  return (
    <section className="asset-priority-workspace">
      <div className="asset-priority-workspace__head">
        <div>
          <div className="ui-eyebrow text-xs font-black uppercase">Priority Device Loop</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">重点设备闭环工作台</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            先把已导入的重点设备做成闭环：登录成功、配置备份、版本留存、再转 Ansible 纳管。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate({ scope: 'priority', backup: 'failed' })}
          className="ui-primary-button inline-flex h-11 items-center gap-2 px-4 text-sm font-black transition"
        >
          处理失败项
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, subtext, icon: Icon, tone, criteria }) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(criteria)}
            className={`asset-priority-metric asset-priority-metric--${tone}`}
          >
            <span className="asset-priority-metric__icon">
              <Icon className="h-4 w-4" />
            </span>
            <span className="block text-xs font-black text-slate-500">{label}</span>
            <strong>{value}</strong>
            <span className="block truncate text-xs font-semibold text-slate-500">{subtext}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="asset-priority-section">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-black text-slate-950">纳管分布</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">按类型和机房看重点设备是否集中。</div>
            </div>
            <GitBranch className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryColumn icon={Boxes} title="类型分布">
              {workspace.typeGroups.length ? workspace.typeGroups.map((item) => (
                <StatBar key={item.label} label={item.label} count={item.count} total={workspace.total || 1} meta={`${item.risk} 个风险标签`} tone="bg-cyan-400" />
              )) : (
                <div className="asset-priority-empty">暂无重点设备。</div>
              )}
            </SummaryColumn>
            <SummaryColumn icon={MapPin} title="机房分布">
              {workspace.locationGroups.length ? workspace.locationGroups.map((item) => (
                <StatBar key={item.label} label={item.label} count={item.count} total={workspace.total || 1} meta={`${item.offline} 离线 / ${item.credentialMissing} 未绑密码`} tone="bg-violet-400" />
              )) : (
                <div className="asset-priority-empty">暂无机房分布。</div>
              )}
            </SummaryColumn>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="asset-priority-section">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-950">最近成功版本</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">用于确认重点设备是否持续有版本。</div>
              </div>
              <Database className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="mt-3 space-y-2">
              {workspace.recentAssets.length ? workspace.recentAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onNavigate({ keyword: asset.name })}
                  className="asset-priority-row"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-950">{asset.name}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{asset.managementIp || '-'}</span>
                  </span>
                  <span className="text-right text-xs font-bold text-slate-500">
                    <span className="block text-slate-950">{asset.backup.versionCount || 0} 个版本</span>
                    <span>{formatTime(asset.backup.lastBackupAt)}</span>
                  </span>
                </button>
              )) : (
                <div className="asset-priority-empty">暂无备份版本。</div>
              )}
            </div>
          </div>

          <div className="asset-priority-section">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-950">失败处理队列</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">优先看认证、端口和 SSH 算法问题。</div>
              </div>
              <AlertTriangle className="h-4 w-4 text-rose-300" />
            </div>
            <div className="mt-3 space-y-2">
              {workspace.failureAssets.length ? workspace.failureAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onNavigate({ scope: 'priority', keyword: asset.name, backup: 'failed' })}
                  className="asset-priority-row asset-priority-row--danger"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-950">{asset.name}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{asset.managementIp || '-'}</span>
                  </span>
                  <span className="max-w-[11rem] truncate text-xs font-bold text-rose-200">{asset.backup.targetError || '备份失败'}</span>
                </button>
              )) : (
                <div className="asset-priority-ok">
                  当前重点设备没有备份失败项，可以推进批量执行和 Ansible Inventory。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AssetOverview({ assets, summary, groupSummary, typeOptions, onNavigate, onRefresh, isDataLoading }) {
  const typeCards = useMemo(() => buildOverviewTypeCards(assets, typeOptions), [assets, typeOptions]);
  const governance = useMemo(() => buildAssetGovernance(assets), [assets]);
  const priorityWorkspace = useMemo(() => buildPriorityWorkspace(assets), [assets]);
  const priorityCards = [
    { key: 'backup', label: '配置未接入', count: assets.filter((asset) => asset.riskCodes.includes('backup')).length, tone: 'amber', icon: Database },
    { key: 'credential', label: '密码未受控', count: assets.filter((asset) => asset.riskCodes.includes('credential')).length, tone: 'rose', icon: KeyRound },
    { key: 'automation', label: '未纳管', count: assets.filter((asset) => asset.riskCodes.includes('automation')).length, tone: 'blue', icon: Terminal },
    { key: 'offline', label: '不可达', count: assets.filter((asset) => asset.riskCodes.includes('offline')).length, tone: 'slate', icon: AlertTriangle },
  ];
  const toneClasses = {
    amber: 'asset-priority-card--amber',
    rose: 'asset-priority-card--rose',
    blue: 'asset-priority-card--blue',
    slate: 'asset-priority-card--slate',
  };

  return (
    <div className="space-y-4">
      <section className="asset-kpi-strip">
        <IconTile icon={HardDrive} label="资产总数" value={summary.total} subtext="纳管资产范围" tone="text-blue-600" />
        <IconTile icon={CheckCircle2} label="在线运行" value={summary.healthy} subtext={`${summary.offline} 条离线或未检测`} tone="text-emerald-600" />
        <IconTile icon={Database} label="配置备份" value={`${summary.backupRate}%`} subtext="设备配置采集" tone="text-amber-600" />
        <IconTile icon={KeyRound} label="密码受控" value={`${summary.credentialRate}%`} subtext="按绑定凭据统计" tone="text-violet-600" />
        <IconTile icon={Terminal} label="自动化纳管" value={`${summary.automationRate}%`} subtext="Ansible Inventory" tone="text-blue-600" />
        <IconTile icon={AlertTriangle} label="风险资产" value={summary.riskAssets} subtext="需要优先处理" tone="text-rose-600" />
      </section>

      <AssetGovernancePanel governance={governance} onNavigate={onNavigate} />

      <PriorityWorkspacePanel workspace={priorityWorkspace} onNavigate={onNavigate} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div className="asset-hero-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="ui-eyebrow text-xs font-black uppercase">Asset Workspace</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">按资产类型进入工作区</h2>
              <div className="mt-2 text-sm font-semibold leading-6 text-slate-500">先看总量和风险，再跳到防火墙、交换机、服务器等清单处理。</div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({})}
              className="ui-primary-button inline-flex h-11 items-center gap-2 px-4 text-sm font-black transition"
            >
              查看全部资产
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {typeCards.map((item) => {
              const visual = getTypeCardVisual(item.key);
              const TypeIcon = visual.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate({ type: item.key })}
                  className={`asset-type-card asset-type-card--${visual.tone} text-left transition hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">{item.label}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-500">在线 {item.online} · 风险 {item.risk}</span>
                    </span>
                    <span className="asset-type-icon">
                      <TypeIcon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div className="text-3xl font-black text-slate-950">{item.count}</div>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="asset-type-progress h-full rounded-full"
                        style={{ width: `${Math.max(8, Math.min(100, Math.round((item.online / Math.max(item.count, 1)) * 100)))}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-black text-slate-950">今日优先事项</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">点击卡片直接进入对应风险清单。</div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isDataLoading}
              className="ui-secondary-button inline-flex h-9 items-center gap-1.5 px-3 text-xs font-black transition disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isDataLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {priorityCards.map(({ key, label, count, tone, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate({ risk: key })}
                className={`asset-priority-card ${toneClasses[tone]} flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:border-blue-300/40`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm font-black">{label}</span>
                </div>
                <span className="text-lg font-black">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="ui-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-black text-slate-950">机房入口</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">按机房跳到资产清单，避免在一个表里迷路。</div>
            </div>
            <MapPin className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {groupSummary.datacenters.slice(0, 8).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate({ datacenter: item.label })}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-slate-900">{item.label}</span>
                  <span className="text-sm font-black text-blue-700">{item.count}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.offline} 离线/未检测 · {item.credentialMissing} 未绑密码</div>
              </button>
            ))}
          </div>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-black text-slate-950">资产分布</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">用于判断分类是否干净，异常集中在哪里。</div>
            </div>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryColumn icon={HardDrive} title="类型 Top">
              {groupSummary.types.slice(0, 5).map((item) => (
                <StatBar key={item.label} label={item.label} count={item.count} total={summary.total} meta={`${item.risk} 个风险标签`} tone="bg-violet-500" />
              ))}
            </SummaryColumn>
            <SummaryColumn icon={AlertTriangle} title="风险分布">
              {groupSummary.risks.map((item) => (
                <StatBar key={item.key} label={item.label} count={item.count} total={summary.total} meta={item.count ? '需要处理' : '当前无'} tone="bg-rose-500" />
              ))}
            </SummaryColumn>
          </div>
        </div>
      </section>
    </div>
  );
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

function AssetModal({ title, children, onClose, width = 'max-w-xl' }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full ${width} overflow-auto rounded-lg border border-slate-200 bg-white shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function formInputClass(extra = '') {
  return `h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${extra}`;
}

function CredentialEditorModal({
  mode,
  asset,
  secrets,
  form,
  setForm,
  onClose,
  onSubmit,
  busy,
}) {
  const isBind = mode === 'bind';
  const isEdit = mode === 'edit';
  const title = isBind ? '绑定已有凭据' : isEdit ? '修改凭据' : '新增设备凭据';

  return (
    <AssetModal title={title} onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          当前资产：<span className="font-bold text-slate-800">{asset?.name}</span>
          <span className="ml-2 font-mono">{extractManagementHost(asset?.managementIp) || '-'}</span>
        </div>

        {isBind ? (
          <Field label="选择已有凭据">
            <select
              value={form.id || ''}
              onChange={(event) => {
                const selected = secrets.find((item) => String(item.id) === event.target.value);
                setForm(createCredentialForm(asset, selected || null));
              }}
              className={formInputClass()}
              required
            >
              <option value="">请选择凭据</option>
              {secrets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} / {item.username_hint || '未填账号'} / {item.target_display || '通用'}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="名称">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={formInputClass()}
                required
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="账号">
                <input
                  value={form.secret_username}
                  onChange={(event) => setForm((current) => ({ ...current, secret_username: event.target.value }))}
                  className={formInputClass('font-mono')}
                  required={!isEdit}
                />
              </Field>
              <Field label={isEdit ? '新密码（留空不改）' : '密码'}>
                <input
                  type="password"
                  value={form.secret_value}
                  onChange={(event) => setForm((current) => ({ ...current, secret_value: event.target.value }))}
                  className={formInputClass()}
                  required={!isEdit}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="环境">
                <select value={form.environment} onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value }))} className={formInputClass()}>
                  <option value="production">生产</option>
                  <option value="test">测试</option>
                  <option value="development">开发</option>
                  <option value="other">其他</option>
                </select>
              </Field>
              <Field label="敏感级别">
                <select value={form.sensitivity} onChange={(event) => setForm((current) => ({ ...current, sensitivity: event.target.value }))} className={formInputClass()}>
                  <option value="internal">内部</option>
                  <option value="confidential">机密</option>
                  <option value="restricted">严格受限</option>
                </select>
              </Field>
              <Field label="轮换周期">
                <input
                  type="number"
                  min="1"
                  value={form.rotation_days}
                  onChange={(event) => setForm((current) => ({ ...current, rotation_days: event.target.value }))}
                  className={formInputClass()}
                />
              </Field>
            </div>
            <Field label="责任团队">
              <input
                value={form.owner_team}
                onChange={(event) => setForm((current) => ({ ...current, owner_team: event.target.value }))}
                className={formInputClass()}
              />
            </Field>
            <Field label="备注">
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
            取消
          </button>
          <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </form>
    </AssetModal>
  );
}

function BackupTargetModal({ asset, form, setForm, secrets, onClose, onSubmit, busy }) {
  return (
    <AssetModal title="配置备份目标设置" onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          目标：<span className="font-bold text-slate-800">{asset?.name}</span>
          <span className="ml-2 font-mono">{extractManagementHost(asset?.managementIp) || '-'}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="命令模板">
            <select value={form.command_profile} onChange={(event) => setForm((current) => ({ ...current, command_profile: event.target.value }))} className={formInputClass()}>
              {COMMAND_PROFILE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="绑定凭据">
            <select value={form.credential || ''} onChange={(event) => setForm((current) => ({ ...current, credential: event.target.value }))} className={formInputClass()}>
              <option value="">自动匹配或暂不绑定</option>
              {secrets.map((item) => (
                <option key={item.id} value={item.id}>{item.name} / {item.username_hint || '未填账号'}</option>
              ))}
            </select>
          </Field>
          <Field label="SSH 端口">
            <input type="number" min="1" max="65535" value={form.ssh_port} onChange={(event) => setForm((current) => ({ ...current, ssh_port: event.target.value }))} className={formInputClass()} />
          </Field>
          <Field label="连接超时（秒）">
            <input type="number" min="5" max="600" value={form.timeout_seconds} onChange={(event) => setForm((current) => ({ ...current, timeout_seconds: event.target.value }))} className={formInputClass()} />
          </Field>
          <Field label="保留版本数">
            <input type="number" min="1" max="200" value={form.retention_count} onChange={(event) => setForm((current) => ({ ...current, retention_count: event.target.value }))} className={formInputClass()} />
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={!!form.save_before_backup} onChange={(event) => setForm((current) => ({ ...current, save_before_backup: event.target.checked }))} />
            采集前执行 save
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
            取消
          </button>
          <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            保存设置
          </button>
        </div>
      </form>
    </AssetModal>
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

function DirectoryStatus({ icon: Icon, label, value, tone = 'text-slate-600', subtext }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200/80">
      <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-900">{safeText(value)}</div>
      {subtext ? <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{subtext}</div> : null}
    </div>
  );
}

function AssetDirectory({
  assets,
  selectedAssetId,
  selectedBulkAssetIds,
  onSelect,
  onToggleBulkAsset,
  onBulkSelect,
  onClearBulkSelection,
  onBulkProvisionBackup,
  onBulkProvisionAnsible,
  bulkAction,
  sortLabel,
  children,
}) {
  if (assets.length === 0) return <EmptyState />;
  const selectedBulkCount = selectedBulkAssetIds.length;
  const selectedBulkSet = new Set(selectedBulkAssetIds);
  const busy = !!bulkAction;

  return (
    <section className="asset-directory-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
        <div>
          <div className="text-lg font-black text-slate-950">资产目录</div>
          <div className="mt-1 text-sm font-semibold text-slate-500">用设备卡片承载状态、位置、密码、备份和纳管信息，点击一台设备后在右侧查看完整档案。</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5">{assets.length} 条</span>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700">{sortLabel}</span>
        </div>
      </div>
      <div className="asset-bulk-bar">
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">批量治理</div>
          <div className="mt-0.5 text-xs font-semibold text-slate-500">
            已选 {selectedBulkCount} 台，按当前筛选结果快速处理备份和 Ansible 纳管。
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onBulkSelect('current')} className="ui-secondary-button h-9 px-3 text-xs font-black">
            全选当前
          </button>
          <button type="button" onClick={() => onBulkSelect('backup_ready')} className="ui-secondary-button h-9 px-3 text-xs font-black">
            选择可备份
          </button>
          <button type="button" onClick={() => onBulkSelect('ansible_ready')} className="ui-secondary-button h-9 px-3 text-xs font-black">
            选择可纳管
          </button>
          <button type="button" onClick={onClearBulkSelection} disabled={!selectedBulkCount || busy} className="ui-secondary-button h-9 px-3 text-xs font-black disabled:opacity-50">
            清空
          </button>
          <button
            type="button"
            onClick={onBulkProvisionBackup}
            disabled={!selectedBulkCount || busy}
            className="ui-primary-button inline-flex h-9 items-center gap-2 px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Database className={`h-3.5 w-3.5 ${bulkAction === 'backup' ? 'animate-pulse' : ''}`} />
            批量纳入备份
          </button>
          <button
            type="button"
            onClick={onBulkProvisionAnsible}
            disabled={!selectedBulkCount || busy}
            className="ui-primary-button inline-flex h-9 items-center gap-2 px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Terminal className={`h-3.5 w-3.5 ${bulkAction === 'ansible' ? 'animate-pulse' : ''}`} />
            批量纳管
          </button>
        </div>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="max-h-[calc(100vh-17rem)] min-w-0 overflow-y-auto bg-white">
          <div className="space-y-2 p-3">
            {assets.map((asset) => {
              const selected = selectedAssetId === asset.id;
              const bulkSelected = selectedBulkSet.has(asset.id);
              const hasCredential = asset.credential.status === 'active' && asset.credential.count > 0;
              const hasBackup = asset.backup.versionCount > 0 || asset.backup.status === 'ready';
              const hasAnsible = asset.automation.managed;
              const mainRisk = asset.riskCodes[0];
              return (
                <div
                  key={asset.id}
                  onClick={() => onSelect(asset.id)}
                  className={`asset-directory-row block w-full min-w-0 px-4 py-4 text-left transition ${
                    selected
                      ? 'bg-blue-50 shadow-[inset_4px_0_0_#2557f6,0_12px_28px_rgba(37,87,246,0.08)]'
                      : 'bg-white hover:bg-slate-50'
                  } ${bulkSelected ? 'asset-directory-row--bulk-selected' : ''}`}
                >
                  <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.35fr)]">
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleBulkAsset(asset.id);
                        }}
                        className={`asset-bulk-check ${bulkSelected ? 'asset-bulk-check--selected' : ''}`}
                        title={bulkSelected ? '取消选择' : '选择资产'}
                      >
                        {bulkSelected ? '✓' : ''}
                      </button>
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-950 text-white'}`}>
                        <HardDrive className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950">{asset.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          <Pill tone="bg-blue-50 text-blue-700 ring-blue-200">{asset.typeLabel}</Pill>
                          <Pill tone={STATUS_TONES[asset.status] || STATUS_TONES.unknown}>{STATUS_LABELS[asset.status] || asset.status}</Pill>
                          {mainRisk ? <Pill tone="bg-rose-50 text-rose-700 ring-rose-200">{RISK_LABELS[mainRisk]}</Pill> : null}
                        </div>
                        <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                          <span className="min-w-0 truncate font-mono">{safeText(extractManagementHost(asset.managementIp) || asset.managementIp)}</span>
                          <span className="min-w-0 truncate">{safeText([asset.datacenterName, asset.rackCode, asset.rackPosition].filter(Boolean).join(' / '))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
                      <DirectoryStatus
                        icon={KeyRound}
                        label="密码"
                        value={SECRET_LABELS[asset.credential.status]}
                        subtext={`${asset.credential.count} 条凭据`}
                        tone={hasCredential ? 'text-emerald-600' : 'text-rose-600'}
                      />
                      <DirectoryStatus
                        icon={Database}
                        label="配置备份"
                        value={asset.backup.label}
                        subtext={`${asset.backup.versionCount} 个版本`}
                        tone={hasBackup ? 'text-emerald-600' : 'text-amber-600'}
                      />
                      <DirectoryStatus
                        icon={Terminal}
                        label="自动化"
                        value={asset.automation.label}
                        subtext={asset.automation.inventoryName || '-'}
                        tone={hasAnsible ? 'text-emerald-600' : 'text-slate-500'}
                      />
                      <DirectoryStatus
                        icon={ClipboardList}
                        label="最近"
                        value={asset.backup.latestVersion || '-'}
                        subtext={formatTime(asset.backup.lastBackupAt || asset.updatedAt)}
                        tone="text-blue-600"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="asset-detail-canvas min-w-0 border-t border-slate-200/80 p-4 xl:max-h-[calc(100vh-17rem)] xl:overflow-y-auto xl:border-l xl:border-t-0">
          {children}
        </div>
      </div>
    </section>
  );
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
  const groups = asset.automation.groups?.length ? asset.automation.groups : getInventoryGroups(asset);
  const hostName = inventoryToken(asset.automation.inventoryName || asset.name, inventoryToken(asset.id, 'asset'));
  const primaryCredential = asset.credential.items?.[0] || null;
  const userPart = primaryCredential?.username_hint ? ` ansible_user=${primaryCredential.username_hint}` : '';
  return [
    `[${groups[0] || 'unmanaged_assets'}]`,
    `${hostName} ansible_host=${asset.managementIp || '0.0.0.0'} ansible_port=${asset.automation.sshPort || asset.backup.targetSshPort || 22}${userPart}`,
    '',
    `[${groups[0] || 'unmanaged_assets'}:vars]`,
    `device_type=${asset.type || 'unknown'}`,
    `credential_ref=${primaryCredential ? `secret-${primaryCredential.id}` : 'missing'}`,
    `command_profile=${asset.automation.commandProfile || asset.backup.targetCommandProfile || 'huawei_vrp'}`,
  ].join('\n');
}

function AssetDetail({
  asset,
  onProvisionBackup,
  onRunBackup,
  onUpdateManagementIp,
  onOpenCredentialModal,
  onTestCredential,
  onOpenBackupSettings,
  onTestBackupTarget,
  onProvisionAnsible,
  onTestAnsible,
  onNotice,
  backupActionAssetId,
  backupTestAssetId,
  credentialTestAssetId,
  managementIpActionAssetId,
  ansibleActionAssetId,
  ansibleTestAssetId,
}) {
  const [activeTab, setActiveTab] = useState('basic');
  const [isEditingManagementIp, setIsEditingManagementIp] = useState(false);
  const [managementIpDraft, setManagementIpDraft] = useState('');

  useEffect(() => {
    setIsEditingManagementIp(false);
    setManagementIpDraft(extractManagementHost(asset?.managementIp));
  }, [asset?.id, asset?.managementIp]);

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
  const backupTestBusy = backupTestAssetId === asset.id;
  const credentialTestBusy = credentialTestAssetId === asset.id;
  const primaryCredential = asset.credential.items?.[0] || null;
  const managementIpBusy = managementIpActionAssetId === asset.id;
  const ansibleBusy = ansibleActionAssetId === asset.id;
  const ansibleTestBusy = ansibleTestAssetId === asset.id;
  const normalizedManagementIp = extractManagementHost(asset.managementIp);
  const hasManagementIpFormatHint = asset.managementIp && normalizedManagementIp && normalizedManagementIp !== asset.managementIp;

  const handleSaveManagementIp = async () => {
    const nextValue = extractManagementHost(managementIpDraft);
    if (!nextValue) {
      onNotice?.('warning', '请输入管理 IP', '请填写可连接的管理 IP 后再保存。');
      return;
    }
    await onUpdateManagementIp(asset, nextValue);
    setIsEditingManagementIp(false);
  };

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
          <div className="rounded-md bg-slate-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Network className="h-3.5 w-3.5 text-blue-600" />
                管理 IP
              </div>
              {!isEditingManagementIp ? (
                <button
                  type="button"
                  onClick={() => {
                    setManagementIpDraft(normalizedManagementIp || asset.managementIp || '');
                    setIsEditingManagementIp(true);
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-blue-700"
                  title="修改管理 IP"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {isEditingManagementIp ? (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  value={managementIpDraft}
                  onChange={(event) => setManagementIpDraft(event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="172.25.254.130"
                  disabled={managementIpBusy}
                />
                <button
                  type="button"
                  onClick={handleSaveManagementIp}
                  disabled={managementIpBusy}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  title="保存"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManagementIpDraft(normalizedManagementIp || asset.managementIp || '');
                    setIsEditingManagementIp(false);
                  }}
                  disabled={managementIpBusy}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  title="取消"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-1 truncate font-mono text-sm font-black text-slate-950">
                {safeText(normalizedManagementIp || asset.managementIp)}
              </div>
            )}
            {hasManagementIpFormatHint ? (
              <div className="mt-1 truncate text-[11px] font-semibold text-amber-600">
                原值：{asset.managementIp}
              </div>
            ) : null}
          </div>
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
            <InfoRow label="主机名" value={asset.hostname} mono />
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
            <button
              type="button"
              onClick={() => onOpenBackupSettings(asset)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Settings2 className="h-3.5 w-3.5" />
              设置
            </button>
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
              <>
                <button
                  type="button"
                  onClick={() => onTestBackupTarget(asset)}
                  disabled={backupTestBusy || !asset.backup.targetEnabled}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className={`h-3.5 w-3.5 ${backupTestBusy ? 'animate-pulse' : ''}`} />
                  测试连接
                </button>
                <button
                  type="button"
                  onClick={() => onRunBackup(asset)}
                  disabled={backupBusy || !asset.backup.targetEnabled}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${backupBusy ? 'animate-spin' : ''}`} />
                  执行备份
                </button>
              </>
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
          <InfoRow label="命令模板" value={COMMAND_PROFILE_LABELS[asset.backup.targetCommandProfile] || asset.backup.targetCommandProfile} />
          <InfoRow label="SSH 端口" value={asset.backup.targetSshPort} />
          <InfoRow label="采集前保存" value={asset.backup.targetSaveBeforeBackup ? '执行 save' : '不执行 save'} />
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Pill tone={SECRET_TONES[asset.credential.status]}>{SECRET_LABELS[asset.credential.status]}</Pill>
            <span className="text-sm font-bold text-slate-800">{asset.credential.count} 条凭据</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenCredentialModal(asset, 'create')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              新增凭据
            </button>
            <button
              type="button"
              onClick={() => onOpenCredentialModal(asset, 'bind')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              绑定已有
            </button>
            {primaryCredential ? (
              <button
                type="button"
                onClick={() => onTestCredential(asset, primaryCredential)}
                disabled={credentialTestBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className={`h-3.5 w-3.5 ${credentialTestBusy ? 'animate-pulse' : ''}`} />
                测试登录
              </button>
            ) : null}
          </div>
        </div>
        {asset.credential.items.length ? (
          <div className="mt-3 space-y-2">
            {asset.credential.items.slice(0, 4).map((secret) => (
              <div key={secret.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-800">{secret.name}</span>
                  <div className="flex items-center gap-2">
                    <Pill tone={SECRET_TONES[secret.lifecycle_status || secret.status || 'active']}>
                      {SECRET_LABELS[secret.lifecycle_status || secret.status || 'active'] || secret.status}
                    </Pill>
                    <button
                      type="button"
                      onClick={() => onOpenCredentialModal(asset, 'edit', secret)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-blue-700"
                      title="修改凭据"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onTestCredential(asset, secret)}
                      disabled={credentialTestBusy}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      title="测试登录"
                    >
                      <CheckCircle2 className={`h-3.5 w-3.5 ${credentialTestBusy ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div className="text-xs font-black text-slate-700">Ansible Inventory</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {asset.automation.managed ? '当前资产已具备自动化纳管条件。' : '补齐管理 IP、凭据和备份目标后即可纳入 Inventory。'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTestAnsible(asset)}
              disabled={ansibleTestBusy || (!asset.automation.managed && !asset.credential.count)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${ansibleTestBusy ? 'animate-pulse' : ''}`} />
              测试连接
            </button>
            <button
              type="button"
              onClick={() => onProvisionAnsible(asset)}
              disabled={ansibleBusy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Terminal className={`h-3.5 w-3.5 ${ansibleBusy ? 'animate-pulse' : ''}`} />
              {asset.automation.managed ? '更新纳管' : '纳入 Inventory'}
            </button>
          </div>
        </div>
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
  const [viewMode, setViewMode] = useState('overview');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [datacenterFilter, setDatacenterFilter] = useState('all');
  const [risk, setRisk] = useState('all');
  const [credentialFilter, setCredentialFilter] = useState('all');
  const [backupFilter, setBackupFilter] = useState('all');
  const [automationFilter, setAutomationFilter] = useState('all');
  const [governanceFilter, setGovernanceFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [selectedBulkAssetIds, setSelectedBulkAssetIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'risk', direction: 'desc' });
  const [bulkAction, setBulkAction] = useState(null);
  const [backupActionAssetId, setBackupActionAssetId] = useState(null);
  const [managementIpActionAssetId, setManagementIpActionAssetId] = useState(null);
  const [credentialActionAssetId, setCredentialActionAssetId] = useState(null);
  const [credentialTestAssetId, setCredentialTestAssetId] = useState(null);
  const [backupTestAssetId, setBackupTestAssetId] = useState(null);
  const [ansibleActionAssetId, setAnsibleActionAssetId] = useState(null);
  const [ansibleTestAssetId, setAnsibleTestAssetId] = useState(null);
  const [credentialModal, setCredentialModal] = useState(null);
  const [credentialForm, setCredentialForm] = useState(null);
  const [backupSettingsModal, setBackupSettingsModal] = useState(null);
  const [backupTargetForm, setBackupTargetForm] = useState(null);
  const [operationNotice, setOperationNotice] = useState(null);
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
      datacenter: datacenterFilter,
      risk,
      credential: credentialFilter,
      backup: backupFilter,
      automation: automationFilter,
      governance: governanceFilter,
      scope: scopeFilter,
    }),
    [assets, automationFilter, backupFilter, credentialFilter, datacenterFilter, governanceFilter, keyword, risk, scopeFilter, status, type],
  );

  const sortedAssets = useMemo(
    () => sortAssets(filteredAssets, sortConfig),
    [filteredAssets, sortConfig],
  );

  const selectedAsset = useMemo(() => {
    const preferred = sortedAssets.find((asset) => asset.id === selectedAssetId);
    return preferred || sortedAssets[0] || null;
  }, [selectedAssetId, sortedAssets]);

  const selectedBulkAssets = useMemo(() => {
    const selectedIds = new Set(selectedBulkAssetIds);
    return assets.filter((asset) => selectedIds.has(asset.id));
  }, [assets, selectedBulkAssetIds]);

  useEffect(() => {
    const validIds = new Set(assets.map((asset) => asset.id));
    setSelectedBulkAssetIds((current) => {
      const next = current.filter((id) => validIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [assets]);

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
    return normalizeActionMessage(payload?.detail || payload?.message, fallback);
  };

  const showOperationNotice = (tone, title, detail) => {
    setOperationNotice({
      id: Date.now(),
      tone,
      title,
      detail: normalizeActionMessage(detail, title),
    });
  };

  const buildAssetSecretPayload = (asset, extra = {}) => ({
    target_type: asset.source === 'device' ? 'device' : 'ip',
    rack_device: asset.source === 'device' ? asset.deviceId : null,
    ip_address: asset.relatedIps?.[0]?.id || null,
    ...extra,
  });

  const syncBackupTargetCredential = async (asset, credentialId) => {
    if (!asset?.backup?.targetId || !credentialId) return;
    await safeFetch(`/api/config-backup-targets/${asset.backup.targetId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: credentialId }),
    });
  };

  const openCredentialModal = (asset, mode, secret = null) => {
    setCredentialModal({ asset, mode, secret });
    setCredentialForm(createCredentialForm(asset, secret));
  };

  const closeCredentialModal = () => {
    setCredentialModal(null);
    setCredentialForm(null);
  };

  const handleSaveCredential = async (event) => {
    event.preventDefault();
    if (!credentialModal || !credentialForm) return;
    const { asset, mode } = credentialModal;
    setCredentialActionAssetId(asset.id);
    try {
      let response;
      if (mode === 'bind') {
        response = await safeFetch(`/api/secrets/${credentialForm.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildAssetSecretPayload(asset)),
        });
      } else {
        const payload = buildAssetSecretPayload(asset, {
          name: credentialForm.name,
          credential_type: 'ssh',
          secret_username: credentialForm.secret_username,
          secret_value: credentialForm.secret_value,
          owner_team: credentialForm.owner_team,
          environment: credentialForm.environment,
          sensitivity: credentialForm.sensitivity,
          rotation_days: Number(credentialForm.rotation_days || 90),
          status: 'active',
          notes: credentialForm.notes,
        });
        if (mode === 'edit' && !payload.secret_value) {
          delete payload.secret_username;
          delete payload.secret_value;
        }
        response = await safeFetch(mode === 'edit' ? `/api/secrets/${credentialForm.id}/` : '/api/secrets/', {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) {
        showOperationNotice('error', '保存凭据失败', await readApiError(response, '保存凭据失败。'));
        return;
      }
      const saved = await response.json().catch(() => null);
      await syncBackupTargetCredential(asset, saved?.id || credentialForm.id);
      closeCredentialModal();
      await refreshAssets();
    } finally {
      setCredentialActionAssetId(null);
    }
  };

  const handleTestCredential = async (asset, secret) => {
    if (!asset || !secret) return;
    const managementIp = extractManagementHost(asset.managementIp);
    if (!managementIp) {
      showOperationNotice('warning', '请先补充管理 IP', '测试登录前需要先给资产填写可连接的管理 IP。');
      return;
    }
    setCredentialTestAssetId(asset.id);
    try {
      const response = await safeFetch(`/api/secrets/${secret.id}/test-login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          management_ip: managementIp,
          ssh_port: asset.backup.targetSshPort || 22,
          timeout_seconds: asset.backup.targetTimeoutSeconds || 30,
        }),
      });
      if (!response.ok) {
        showOperationNotice('error', '测试登录失败', await readApiError(response, '测试登录失败。'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      showOperationNotice('success', '测试登录成功', payload.message || 'SSH 登录测试成功。');
    } finally {
      setCredentialTestAssetId(null);
    }
  };

  const openBackupSettings = (asset) => {
    setBackupSettingsModal({ asset });
    setBackupTargetForm(createBackupTargetForm(asset));
  };

  const closeBackupSettings = () => {
    setBackupSettingsModal(null);
    setBackupTargetForm(null);
  };

  const handleSaveBackupSettings = async (event) => {
    event.preventDefault();
    if (!backupSettingsModal || !backupTargetForm) return;
    const { asset } = backupSettingsModal;
    const managementIp = extractManagementHost(asset.managementIp);
    if (!managementIp) {
      showOperationNotice('warning', '请先补充管理 IP', '保存配置备份目标前需要先给资产填写可连接的管理 IP。');
      return;
    }
    setBackupActionAssetId(asset.id);
    try {
      const payload = {
        name: asset.name,
        management_ip: managementIp,
        rack_device: asset.source === 'device' ? asset.deviceId : null,
        ip_address: asset.relatedIps?.[0]?.id || null,
        device_type: asset.type,
        command_profile: backupTargetForm.command_profile,
        ssh_port: Number(backupTargetForm.ssh_port || 22),
        timeout_seconds: Number(backupTargetForm.timeout_seconds || 30),
        save_before_backup: !!backupTargetForm.save_before_backup,
        retention_count: Number(backupTargetForm.retention_count || 1),
        credential: backupTargetForm.credential || null,
      };
      const response = await safeFetch(
        asset.backup.targetId ? `/api/config-backup-targets/${asset.backup.targetId}/` : '/api/config-backup-targets/provision/',
        {
          method: asset.backup.targetId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        showOperationNotice('error', '保存配置备份目标失败', await readApiError(response, '保存配置备份目标失败。'));
        return;
      }
      closeBackupSettings();
      await refreshAssets();
    } finally {
      setBackupActionAssetId(null);
    }
  };

  const handleTestBackupTarget = async (asset) => {
    if (!asset?.backup?.targetId) {
      showOperationNotice('warning', '请先创建配置备份目标', '该资产还没有配置备份目标，先在右侧“备份”里完成设置。');
      return;
    }
    setBackupTestAssetId(asset.id);
    try {
      const response = await safeFetch(`/api/config-backup-targets/${asset.backup.targetId}/test/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        showOperationNotice('error', '测试连接失败', await readApiError(response, '测试连接失败。'));
        await refreshAssets();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      showOperationNotice('success', '测试连接成功', payload.message || 'SSH 登录测试成功。');
    } finally {
      setBackupTestAssetId(null);
    }
  };

  const handleTestBackupTargetNotice = async (asset) => {
    if (!asset?.backup?.targetId) {
      showOperationNotice('warning', '请先创建配置备份目标', '该资产还没有配置备份目标，先在右侧“备份”里完成设置。');
      return;
    }
    setBackupTestAssetId(asset.id);
    try {
      const response = await safeFetch(`/api/config-backup-targets/${asset.backup.targetId}/test/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        showOperationNotice('error', '测试连接失败', await readApiError(response, '测试连接失败。'));
        await refreshAssets();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      showOperationNotice('success', '测试连接成功', payload.message || 'SSH 登录测试成功。');
    } finally {
      setBackupTestAssetId(null);
    }
  };

  const handleUpdateManagementIp = async (asset, nextValue) => {
    const nextHost = extractManagementHost(nextValue);
    if (!asset || !nextHost) {
      showOperationNotice('warning', '请输入管理 IP', '请填写可连接的管理 IP 后再保存。');
      return;
    }

    const isDeviceAsset = asset.source === 'device' && asset.deviceId;
    const ipAssetId = asset.relatedIps?.[0]?.id;
    const endpoint = isDeviceAsset ? `/api/rack-devices/${asset.deviceId}/` : `/api/ips/${ipAssetId}/`;
    const payload = isDeviceAsset ? { mgmt_ip: nextHost } : { ip_address: nextHost };

    if (!isDeviceAsset && !ipAssetId) {
      showOperationNotice('warning', '无法更新管理 IP', '当前资产没有可更新的 IP 地址台账记录。');
      return;
    }

    setManagementIpActionAssetId(asset.id);
    try {
      const response = await safeFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        showOperationNotice('error', '更新管理 IP 失败', await readApiError(response, '更新管理 IP 失败。'));
        return;
      }

      if (asset.backup?.targetId) {
        const targetResponse = await safeFetch(`/api/config-backup-targets/${asset.backup.targetId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ management_ip: nextHost }),
        });
        if (!targetResponse.ok) {
          showOperationNotice('warning', '管理 IP 已更新', await readApiError(targetResponse, '管理 IP 已更新，但同步配置备份目标失败。'));
        }
      }

      await refreshAssets();
    } finally {
      setManagementIpActionAssetId(null);
    }
  };

  const handleProvisionBackup = async (asset) => {
    const managementIp = extractManagementHost(asset?.managementIp);
    if (!managementIp) {
      showOperationNotice('warning', '请先补充管理 IP', '创建配置备份目标前需要先给资产填写可连接的管理 IP。');
      return;
    }
    setBackupActionAssetId(asset.id);
    try {
      const response = await safeFetch('/api/config-backup-targets/provision/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: asset.name,
          management_ip: managementIp,
          rack_device: asset.source === 'device' ? asset.deviceId : null,
          ip_address: asset.relatedIps[0]?.id || null,
          device_type: asset.type,
          command_profile: 'huawei_vrp',
          ssh_port: 22,
          timeout_seconds: 30,
          save_before_backup: true,
          retention_count: 1,
          credential: asset.credential.items?.[0]?.id || null,
        }),
      });
      if (!response.ok) {
        showOperationNotice('error', '创建配置备份目标失败', await readApiError(response, '创建配置备份目标失败。'));
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
        showOperationNotice('error', '执行配置备份失败', await readApiError(response, '执行配置备份失败。'));
        await refreshAssets();
        return;
      }
      showOperationNotice('success', '执行配置备份完成', '已完成本次配置备份任务，右侧版本列表会同步刷新。');
      await refreshAssets();
    } finally {
      setBackupActionAssetId(null);
    }
  };

  const getAnsibleHostId = (asset) => (asset?.backup?.targetId ? `target-${asset.backup.targetId}` : asset?.id);

  const handleBulkProvisionBackup = async () => {
    if (!selectedBulkAssets.length) return;
    const candidates = selectedBulkAssets.filter((asset) => getAssetGovernanceFlags(asset).includes('backup_ready'));
    if (!candidates.length) {
      showOperationNotice('warning', '没有可接入备份的资产', '当前选择里没有同时具备管理 IP 和密码凭据、且尚未接入备份的资产。');
      return;
    }

    setBulkAction('backup');
    let success = 0;
    let failed = 0;
    try {
      for (const asset of candidates) {
        const managementIp = extractManagementHost(asset.managementIp);
        const response = await safeFetch('/api/config-backup-targets/provision/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: asset.name,
            management_ip: managementIp,
            rack_device: asset.source === 'device' ? asset.deviceId : null,
            ip_address: asset.relatedIps[0]?.id || null,
            device_type: asset.type,
            command_profile: asset.backup.targetCommandProfile || 'huawei_vrp',
            ssh_port: asset.backup.targetSshPort || 22,
            timeout_seconds: asset.backup.targetTimeoutSeconds || 30,
            save_before_backup: asset.backup.targetSaveBeforeBackup ?? true,
            retention_count: asset.backup.targetRetentionCount || 1,
            credential: asset.credential.items?.[0]?.id || null,
          }),
        });
        if (response.ok) success += 1;
        else failed += 1;
      }
      await refreshAssets();
      if (!failed) clearBulkSelection();
      showOperationNotice(
        failed ? 'warning' : 'success',
        '批量备份目标处理完成',
        `成功 ${success}，失败 ${failed}，跳过 ${selectedBulkAssets.length - candidates.length}。`,
      );
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkProvisionAnsible = async () => {
    if (!selectedBulkAssets.length) return;
    const candidates = selectedBulkAssets.filter((asset) => getAssetGovernanceFlags(asset).includes('ansible_ready'));
    if (!candidates.length) {
      showOperationNotice('warning', '没有可纳入 Ansible 的资产', '当前选择里没有同时具备管理 IP 和密码凭据、且尚未纳入 Ansible 的资产。');
      return;
    }

    setBulkAction('ansible');
    try {
      const response = await safeFetch('/api/ansible/provision/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_ids: candidates.map((asset) => getAnsibleHostId(asset)),
          command_profile: 'huawei_vrp',
          ssh_port: 22,
          timeout_seconds: 30,
          save_before_backup: true,
          retention_count: 1,
        }),
      });
      if (!response.ok) {
        showOperationNotice('error', '批量纳入 Ansible 失败', await readApiError(response, '批量纳入 Ansible Inventory 失败。'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const summary = payload.summary || {};
      await refreshAssets();
      clearBulkSelection();
      showOperationNotice(
        summary.failed ? 'warning' : 'success',
        '批量纳管完成',
        `新增 ${summary.created || 0}，更新 ${summary.updated || 0}，失败 ${summary.failed || 0}，跳过 ${selectedBulkAssets.length - candidates.length}。`,
      );
    } finally {
      setBulkAction(null);
    }
  };

  const handleProvisionAnsible = async (asset) => {
    if (!extractManagementHost(asset?.managementIp)) {
      showOperationNotice('warning', '请先补充管理 IP', '纳入 Ansible 前需要先给资产填写可连接的管理 IP。');
      return;
    }
    if (!asset?.credential?.count) {
      showOperationNotice('warning', '请先绑定登录凭据', '请先在资产右侧“密码”标签绑定登录凭据。');
      return;
    }
    setAnsibleActionAssetId(asset.id);
    try {
      const response = await safeFetch('/api/ansible/provision/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_ids: [getAnsibleHostId(asset)],
          command_profile: asset.backup.targetCommandProfile || 'huawei_vrp',
          ssh_port: asset.backup.targetSshPort || 22,
          timeout_seconds: asset.backup.targetTimeoutSeconds || 30,
          save_before_backup: asset.backup.targetSaveBeforeBackup ?? true,
          retention_count: asset.backup.targetRetentionCount || 1,
        }),
      });
      if (!response.ok) {
        showOperationNotice('error', '纳入 Ansible 失败', await readApiError(response, '纳入 Ansible Inventory 失败。'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const summary = payload.summary || {};
      showOperationNotice(
        summary.failed ? 'warning' : 'success',
        'Ansible 纳管完成',
        `新增 ${summary.created || 0}，更新 ${summary.updated || 0}，失败 ${summary.failed || 0}。`,
      );
      await refreshAssets();
    } finally {
      setAnsibleActionAssetId(null);
    }
  };

  const handleTestAnsible = async (asset) => {
    if (!extractManagementHost(asset?.managementIp)) {
      showOperationNotice('warning', '请先补充管理 IP', '测试 Ansible 登录前需要先给资产填写可连接的管理 IP。');
      return;
    }
    if (!asset?.credential?.count) {
      showOperationNotice('warning', '请先绑定登录凭据', '请先绑定登录凭据后再测试。');
      return;
    }
    setAnsibleTestAssetId(asset.id);
    try {
      const response = await safeFetch('/api/ansible/test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_ids: [getAnsibleHostId(asset)] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showOperationNotice('error', 'Ansible 登录测试失败', normalizeActionMessage(payload.detail || payload.message, 'Ansible 登录测试失败。'));
        return;
      }
      const result = payload.results?.[0];
      showOperationNotice('success', 'Ansible 登录测试完成', result?.detail || (payload.summary?.success ? 'Ansible 登录测试成功。' : '没有可测试的主机。'));
    } finally {
      setAnsibleTestAssetId(null);
    }
  };


  const typeOptions = useMemo(() => {
    const entries = new Map();
    assets.forEach((asset) => entries.set(asset.type, asset.typeLabel));
    return Array.from(entries.entries()).sort((left, right) => {
      const leftOrder = DEVICE_TYPE_OPTION_ORDER.get(left[0]) ?? 999;
      const rightOrder = DEVICE_TYPE_OPTION_ORDER.get(right[0]) ?? 999;
      return leftOrder - rightOrder || left[1].localeCompare(right[1], 'zh-CN');
    });
  }, [assets]);

  const datacenterOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.datacenterName || '未标注机房')))
      .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true })),
    [assets],
  );

  const resetListFilters = () => {
    setKeyword('');
    setStatus('all');
    setType('all');
    setDatacenterFilter('all');
    setRisk('all');
    setCredentialFilter('all');
    setBackupFilter('all');
    setAutomationFilter('all');
    setGovernanceFilter('all');
    setScopeFilter('all');
  };

  const navigateToList = (criteria = {}) => {
    resetListFilters();
    setViewMode('list');
    setSelectedAssetId(null);
    if (criteria.keyword) setKeyword(criteria.keyword);
    if (criteria.type) setType(criteria.type);
    if (criteria.datacenter) setDatacenterFilter(criteria.datacenter);
    if (criteria.risk) setRisk(criteria.risk);
    if (criteria.status) setStatus(criteria.status);
    if (criteria.credential) setCredentialFilter(criteria.credential);
    if (criteria.backup) setBackupFilter(criteria.backup);
    if (criteria.automation) setAutomationFilter(criteria.automation);
    if (criteria.governance) setGovernanceFilter(criteria.governance);
    if (criteria.scope) setScopeFilter(criteria.scope);
  };

  const handleToggleBulkAsset = (assetId) => {
    setSelectedBulkAssetIds((current) => (
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    ));
  };

  const handleBulkSelect = (mode) => {
    const scopedAssets = mode === 'current'
      ? sortedAssets
      : sortedAssets.filter((asset) => getAssetGovernanceFlags(asset).includes(mode));
    setSelectedBulkAssetIds(scopedAssets.map((asset) => asset.id));
  };

  const clearBulkSelection = () => setSelectedBulkAssetIds([]);

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
    <div className="asset-center-page h-full overflow-y-auto overflow-x-hidden p-4 lg:p-5">
      <div className="mx-auto max-w-[1880px] space-y-4">
        <section className="asset-hero-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="ui-eyebrow flex items-center gap-2 text-xs font-black uppercase">
              <ShieldCheck className="h-4 w-4" />
              V2 Asset Center
            </div>
            <h1 className="mt-2 text-3xl font-black text-slate-950">资产中心</h1>
            <div className="mt-2 text-base font-semibold text-slate-500">设备、配置、密码、自动化的统一资产工作台</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`h-10 rounded-xl px-4 text-sm font-black transition ${viewMode === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                总览
              </button>
              <button
                type="button"
                onClick={() => navigateToList({})}
                className={`h-10 rounded-xl px-4 text-sm font-black transition ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                清单
              </button>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isDataLoading}
              className="ui-secondary-button inline-flex h-11 items-center gap-2 px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
              title="刷新资产数据"
            >
              <RefreshCw className={`h-4 w-4 ${isDataLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </section>

        {operationNotice ? (
          <div
            className={`rounded-2xl border bg-slate-950/95 px-4 py-3 text-slate-100 shadow-[0_18px_50px_rgba(0,0,0,0.28)] ${
              operationNotice.tone === 'success'
                ? 'border-emerald-400/35'
                : operationNotice.tone === 'warning'
                  ? 'border-amber-400/35'
                  : 'border-rose-400/35'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                operationNotice.tone === 'success'
                  ? 'bg-emerald-400/15 text-emerald-200'
                  : operationNotice.tone === 'warning'
                    ? 'bg-amber-400/15 text-amber-200'
                    : 'bg-rose-400/15 text-rose-200'
              }`}
              >
                {operationNotice.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">{operationNotice.title}</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-slate-300">{operationNotice.detail}</div>
              </div>
              <button
                type="button"
                onClick={() => setOperationNotice(null)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                title="关闭提示"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {viewMode === 'overview' ? (
          <AssetOverview
            assets={assets}
            summary={summary}
            groupSummary={buildGroupSummary(assets)}
            typeOptions={typeOptions}
            onNavigate={navigateToList}
            onRefresh={onRefresh}
            isDataLoading={isDataLoading}
          />
        ) : (
          <>
            <section className="ui-card sticky top-0 z-20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-black text-blue-700">资产清单</span>
                  {datacenterFilter !== 'all' ? <span className="rounded-lg bg-slate-100 px-3 py-1.5">机房：{datacenterFilter}</span> : null}
                  {type !== 'all' ? <span className="rounded-lg bg-slate-100 px-3 py-1.5">类型：{DEVICE_TYPE_LABELS[type] || type}</span> : null}
                  {risk !== 'all' ? <span className="rounded-lg bg-slate-100 px-3 py-1.5">风险：{RISK_LABELS[risk] || risk}</span> : null}
                  {governanceFilter !== 'all' ? <span className="rounded-lg bg-slate-100 px-3 py-1.5">治理：{GOVERNANCE_LABELS[governanceFilter] || governanceFilter}</span> : null}
                  {scopeFilter === 'priority' ? <span className="rounded-lg bg-slate-100 px-3 py-1.5">范围：重点设备</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('overview')}
                    className="ui-secondary-button h-9 px-3 text-xs font-black"
                  >
                    返回总览
                  </button>
                  <button
                    type="button"
                    onClick={resetListFilters}
                    className="ui-secondary-button h-9 px-3 text-xs font-black"
                  >
                    清除筛选
                  </button>
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_minmax(0,2.5fr)]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    placeholder="搜索名称、主机名、IP、序列号、项目、负责人"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[repeat(9,minmax(112px,1fr))_90px]">
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
                    value={datacenterFilter}
                    onChange={(event) => setDatacenterFilter(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">全部机房</option>
                    {datacenterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">全部类型</option>
                    {typeOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={risk}
                    onChange={(event) => setRisk(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">全部纳管</option>
                    <option value="managed">已纳管</option>
                    <option value="unmanaged">未纳管</option>
                  </select>
                  <select
                    value={governanceFilter}
                    onChange={(event) => setGovernanceFilter(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    {Object.entries(GOVERNANCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={sortOptionValue}
                    onChange={handleSortOptionChange}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    title="排序方式"
                  >
                    {hasPresetSortOption ? null : <option value={sortOptionValue}>{currentSortLabel}</option>}
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-600">
                    <Filter className="h-4 w-4 text-slate-400" />
                    {filteredAssets.length}
                  </div>
                </div>
              </div>
            </section>

            <AssetDirectory
                assets={sortedAssets}
                selectedAssetId={selectedAsset?.id}
                selectedBulkAssetIds={selectedBulkAssetIds}
                onSelect={setSelectedAssetId}
                onToggleBulkAsset={handleToggleBulkAsset}
                onBulkSelect={handleBulkSelect}
                onClearBulkSelection={clearBulkSelection}
                onBulkProvisionBackup={handleBulkProvisionBackup}
                onBulkProvisionAnsible={handleBulkProvisionAnsible}
                bulkAction={bulkAction}
                sortLabel={sortDisplayLabel}
              >
              <AssetDetail
                asset={selectedAsset}
                onProvisionBackup={handleProvisionBackup}
                onRunBackup={handleRunBackup}
                onUpdateManagementIp={handleUpdateManagementIp}
                onOpenCredentialModal={openCredentialModal}
                onTestCredential={handleTestCredential}
                onOpenBackupSettings={openBackupSettings}
                onTestBackupTarget={handleTestBackupTargetNotice}
                onProvisionAnsible={handleProvisionAnsible}
                onTestAnsible={handleTestAnsible}
                onNotice={showOperationNotice}
                backupActionAssetId={backupActionAssetId}
                backupTestAssetId={backupTestAssetId}
                credentialTestAssetId={credentialTestAssetId}
                managementIpActionAssetId={managementIpActionAssetId}
                ansibleActionAssetId={ansibleActionAssetId}
                ansibleTestAssetId={ansibleTestAssetId}
              />
            </AssetDirectory>
          </>
        )}
      </div>
      {credentialModal && credentialForm ? (
        <CredentialEditorModal
          mode={credentialModal.mode}
          asset={credentialModal.asset}
          secrets={secrets}
          form={credentialForm}
          setForm={setCredentialForm}
          onClose={closeCredentialModal}
          onSubmit={handleSaveCredential}
          busy={credentialActionAssetId === credentialModal.asset.id}
        />
      ) : null}
      {backupSettingsModal && backupTargetForm ? (
        <BackupTargetModal
          asset={backupSettingsModal.asset}
          form={backupTargetForm}
          setForm={setBackupTargetForm}
          secrets={secrets}
          onClose={closeBackupSettings}
          onSubmit={handleSaveBackupSettings}
          busy={backupActionAssetId === backupSettingsModal.asset.id}
        />
      ) : null}
    </div>
  );
}
