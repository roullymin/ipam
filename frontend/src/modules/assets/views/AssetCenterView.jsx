import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
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

function Pill({ children, tone = 'bg-slate-100 text-slate-700 ring-slate-200' }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, label, value, tone = 'text-slate-700', subtext }) {
  return (
    <div className="min-h-[112px] rounded-lg border border-white bg-white/82 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-3 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 min-h-5 text-xs text-slate-500">{subtext}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center">
      <div>
        <Server className="mx-auto h-8 w-8 text-slate-400" />
        <div className="mt-3 text-sm font-bold text-slate-800">暂无资产数据</div>
        <div className="mt-1 text-sm text-slate-500">当前筛选条件下没有可显示的设备。</div>
      </div>
    </div>
  );
}

function buildAssets({ datacenters, racks, rackDevices, ips, secrets, secretsLoaded }) {
  const datacenterMap = new Map(asArray(datacenters).map((item) => [String(item.id), item]));
  const rackMap = new Map(asArray(racks).map((item) => [String(item.id), item]));
  const ipList = asArray(ips);
  const secretList = asArray(secrets);
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

  const deviceAssets = asArray(rackDevices).map((device) => {
    usedDeviceKeys.add(normalize(device.name));
    const rack = rackMap.get(String(device.rack));
    const datacenter = rack ? datacenterMap.get(String(rack.datacenter)) : null;
    const relatedIps = findIpsForDevice(device);
    const assetIpIds = new Set(relatedIps.map((ip) => String(ip.id)));
    const credential = getSecretState(assetIpIds, device.id);
    const status = device.status || 'unknown';
    const riskCodes = [];
    if (['offline', 'unknown'].includes(status)) riskCodes.push('offline');
    if (credential.status === 'missing') riskCodes.push('credential');
    riskCodes.push('backup', 'automation');

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
      managementIp: device.mgmt_ip || relatedIps[0]?.ip_address || '',
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
      backup: { status: 'pending', label: '待接入', versionCount: 0, lastBackupAt: null },
      automation: { managed: false, label: '未纳管', groups: [], lastJobStatus: null },
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
      const riskCodes = [];
      if (['offline', 'unknown'].includes(status)) riskCodes.push('offline');
      if (credential.status === 'missing') riskCodes.push('credential');
      riskCodes.push('backup', 'automation');

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
        backup: { status: 'pending', label: '待接入', versionCount: 0, lastBackupAt: null },
        automation: { managed: false, label: '未纳管', groups: [], lastJobStatus: null },
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

function AssetTable({ assets, selectedAssetId, onSelect }) {
  if (assets.length === 0) return <EmptyState />;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-auto">
        <table className="min-w-[1040px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left">资产</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">位置</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">状态</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">配置备份</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">密码</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">自动化</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">责任</th>
              <th className="border-b border-slate-200 px-4 py-3 text-left">风险</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const selected = selectedAssetId === asset.id;
              return (
                <tr
                  key={asset.id}
                  className={`cursor-pointer align-top transition ${selected ? 'bg-cyan-50/80' : 'hover:bg-slate-50'}`}
                  onClick={() => onSelect(asset.id)}
                >
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
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
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                    <div className="font-semibold text-slate-800">{asset.datacenterName || '-'}</div>
                    <div className="mt-1 text-xs">{[asset.rackCode, asset.rackPosition].filter(Boolean).join(' / ') || '-'}</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Pill tone={STATUS_TONES[asset.status] || STATUS_TONES.unknown}>{STATUS_LABELS[asset.status] || asset.status}</Pill>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Pill tone="bg-amber-50 text-amber-700 ring-amber-200">{asset.backup.label}</Pill>
                    <div className="mt-1 text-xs text-slate-500">{asset.backup.versionCount} 个版本</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Pill tone={SECRET_TONES[asset.credential.status]}>{SECRET_LABELS[asset.credential.status]}</Pill>
                    <div className="mt-1 text-xs text-slate-500">{asset.credential.count} 条</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Pill tone="bg-slate-100 text-slate-600 ring-slate-200">{asset.automation.label}</Pill>
                    <div className="mt-1 text-xs text-slate-500">{asset.automation.groups.length || 0} 组</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                    <div className="font-semibold text-slate-800">{asset.project || '-'}</div>
                    <div className="mt-1 text-xs">{asset.contact || '-'}</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex max-w-[180px] flex-wrap gap-1.5">
                      {asset.riskCodes.slice(0, 3).map((risk) => (
                        <Pill key={risk} tone="bg-rose-50 text-rose-700 ring-rose-200">{RISK_LABELS[risk]}</Pill>
                      ))}
                    </div>
                  </td>
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
        <Icon className="h-4 w-4 text-cyan-600" />
        {title}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className={`max-w-[62%] text-right text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {safeText(value)}
      </span>
    </div>
  );
}

function AssetDetail({ asset }) {
  if (!asset) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">
        请选择一台资产。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Asset</div>
            <div className="mt-2 text-xl font-black">{asset.name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="bg-white/10 text-cyan-100 ring-white/10">{asset.typeLabel}</Pill>
              <Pill tone={STATUS_TONES[asset.status] || STATUS_TONES.unknown}>{STATUS_LABELS[asset.status] || asset.status}</Pill>
            </div>
          </div>
          <Server className="h-8 w-8 text-cyan-200" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-white/8 p-3">
            <div className="text-xs text-slate-300">管理 IP</div>
            <div className="mt-1 font-mono font-bold">{safeText(asset.managementIp)}</div>
          </div>
          <div className="rounded-lg bg-white/8 p-3">
            <div className="text-xs text-slate-300">位置</div>
            <div className="mt-1 truncate font-bold">{safeText([asset.datacenterName, asset.rackCode].filter(Boolean).join(' / '))}</div>
          </div>
        </div>
      </section>

      <DetailBlock icon={MapPin} title="身份与位置">
        <InfoRow label="厂商" value={asset.vendor} />
        <InfoRow label="型号" value={asset.model} />
        <InfoRow label="系统版本" value={asset.osVersion} />
        <InfoRow label="序列号" value={asset.serialNumber} mono />
        <InfoRow label="资产编号" value={asset.assetTag} />
        <InfoRow label="机柜位置" value={[asset.rackCode, asset.rackPosition].filter(Boolean).join(' / ')} />
      </DetailBlock>

      <DetailBlock icon={Database} title="配置备份">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs font-semibold text-amber-700">状态</div>
            <div className="mt-1 text-sm font-black text-amber-900">{asset.backup.label}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-500">版本</div>
            <div className="mt-1 text-sm font-black text-slate-900">{asset.backup.versionCount}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-500">最近</div>
            <div className="mt-1 text-sm font-black text-slate-900">{formatTime(asset.backup.lastBackupAt)}</div>
          </div>
        </div>
      </DetailBlock>

      <DetailBlock icon={KeyRound} title="密码状态">
        <div className="flex items-center justify-between gap-3">
          <Pill tone={SECRET_TONES[asset.credential.status]}>{SECRET_LABELS[asset.credential.status]}</Pill>
          <span className="text-sm font-bold text-slate-800">{asset.credential.count} 条凭据</span>
        </div>
        {asset.credential.items.length ? (
          <div className="mt-3 space-y-2">
            {asset.credential.items.slice(0, 4).map((secret) => (
              <div key={secret.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-800">{secret.name}</span>
                  <Pill tone={SECRET_TONES[secret.lifecycle_status || secret.status || 'active']}>
                    {SECRET_LABELS[secret.lifecycle_status || secret.status || 'active'] || secret.status}
                  </Pill>
                </div>
                <div className="mt-1 text-xs text-slate-500">{secret.username_hint || '-'} / {secret.owner_team || '-'}</div>
              </div>
            ))}
          </div>
        ) : null}
      </DetailBlock>

      <DetailBlock icon={Terminal} title="自动化">
        <InfoRow label="Ansible" value={asset.automation.label} />
        <InfoRow label="Inventory" value={asset.automation.inventoryName} />
        <InfoRow label="分组" value={asset.automation.groups.join(', ')} />
        <InfoRow label="最近任务" value={asset.automation.lastJobStatus} />
      </DetailBlock>

      <DetailBlock icon={Network} title="关联 IP">
        {asset.relatedIps.length ? (
          <div className="space-y-2">
            {asset.relatedIps.map((ip) => (
              <div key={ip.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-mono text-sm font-bold text-slate-800">{ip.ip_address}</span>
                <Pill tone={STATUS_TONES[ip.status] || STATUS_TONES.unknown}>{STATUS_LABELS[ip.status] || ip.status || '未检测'}</Pill>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">暂无关联 IP。</div>
        )}
      </DetailBlock>
    </div>
  );
}

export default function AssetCenterView({
  datacenters = [],
  racks = [],
  rackDevices = [],
  ips = [],
  secrets = [],
  dataErrors = {},
  isDataLoading = false,
  onRefresh,
}) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [risk, setRisk] = useState('all');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const secretsLoaded = !dataErrors?.secrets;

  const assets = useMemo(
    () => buildAssets({ datacenters, racks, rackDevices, ips, secrets, secretsLoaded }),
    [datacenters, ips, rackDevices, racks, secrets, secretsLoaded],
  );

  const filteredAssets = useMemo(
    () => filterAssets(assets, { keyword, status, type, risk }),
    [assets, keyword, risk, status, type],
  );

  const selectedAsset = useMemo(() => {
    const preferred = assets.find((asset) => asset.id === selectedAssetId);
    return preferred || filteredAssets[0] || assets[0] || null;
  }, [assets, filteredAssets, selectedAssetId]);

  const typeOptions = useMemo(() => {
    const entries = new Map();
    assets.forEach((asset) => entries.set(asset.type, asset.typeLabel));
    return Array.from(entries.entries()).sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'));
  }, [assets]);

  const summary = useMemo(() => {
    const healthyStatuses = new Set(['active', 'online']);
    const offlineStatuses = new Set(['offline', 'unknown']);
    const credentialReady = assets.filter((asset) => asset.credential.status === 'active').length;
    const riskAssets = assets.filter((asset) => asset.riskCodes.length > 0).length;
    return {
      total: assets.length,
      healthy: assets.filter((asset) => healthyStatuses.has(asset.status)).length,
      offline: assets.filter((asset) => offlineStatuses.has(asset.status)).length,
      credentialRate: assets.length ? Math.round((credentialReady / assets.length) * 100) : 0,
      backupRate: 0,
      automationRate: 0,
      riskAssets,
    };
  }, [assets]);

  return (
    <div className="h-full overflow-auto bg-slate-50/70 p-5 lg:p-7">
      <div className="mx-auto max-w-[1900px] space-y-5">
        <section className="rounded-lg border border-white bg-white/82 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                <ShieldCheck className="h-4 w-4" />
                V2 Asset Center
              </div>
              <h1 className="mt-2 text-2xl font-black text-slate-950">资产中心</h1>
              <div className="mt-1 text-sm text-slate-500">设备、配置、密码、自动化的统一资产视图</div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isDataLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="刷新资产数据"
            >
              <RefreshCw className={`h-4 w-4 ${isDataLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <IconTile icon={HardDrive} label="资产总数" value={summary.total} subtext={`${filteredAssets.length} 条可见`} tone="text-cyan-600" />
          <IconTile icon={CheckCircle2} label="在线运行" value={summary.healthy} subtext={`${summary.offline} 条离线或未检测`} tone="text-emerald-600" />
          <IconTile icon={Database} label="配置备份" value={`${summary.backupRate}%`} subtext="设备配置采集" tone="text-amber-600" />
          <IconTile icon={KeyRound} label="密码受控" value={`${summary.credentialRate}%`} subtext={dataErrors?.secrets ? '无权限或加载失败' : '按绑定凭据统计'} tone="text-violet-600" />
          <IconTile icon={Terminal} label="自动化纳管" value={`${summary.automationRate}%`} subtext="Ansible Inventory" tone="text-sky-600" />
          <IconTile icon={AlertTriangle} label="风险资产" value={summary.riskAssets} subtext="按当前资产状态计算" tone="text-rose-600" />
        </section>

        <section className="rounded-lg border border-white bg-white/82 p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.4fr)_180px_180px_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                placeholder="搜索名称、IP、序列号、项目、负责人"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
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
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">全部类型</option>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={risk}
              onChange={(event) => setRisk(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">全部风险</option>
              <option value="offline">不可达</option>
              <option value="credential">密码未受控</option>
              <option value="backup">配置未接入</option>
              <option value="automation">未纳管</option>
            </select>
            <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
              <Filter className="h-4 w-4 text-slate-400" />
              {filteredAssets.length}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <AssetTable assets={filteredAssets} selectedAssetId={selectedAsset?.id} onSelect={setSelectedAssetId} />
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <AssetDetail asset={selectedAsset} />
          </aside>
        </section>
      </div>
    </div>
  );
}
