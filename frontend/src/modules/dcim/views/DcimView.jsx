import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return Object.values(value);
  return [];
};

const STATUS_LABELS = {
  active: '运行中',
  offline: '离线',
  maintenance: '维护中',
  planned: '规划中',
  retired: '已退役',
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  offline: 'bg-slate-100 text-slate-600 ring-slate-200',
  maintenance: 'bg-amber-50 text-amber-700 ring-amber-200',
  planned: 'bg-blue-50 text-blue-700 ring-blue-200',
  retired: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function ToolbarButton({ icon: Icon, label, onClick, primary = false, busy = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={
        primary
          ? 'ui-primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50'
          : 'ui-secondary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50'
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

const ICON_TONES = {
  blue: '',
  green: 'ui-icon-box--green',
  amber: 'ui-icon-box--amber',
  rose: 'ui-icon-box--rose',
  slate: 'ui-icon-box--slate',
};

function IconFrame({ icon: Icon, tone = 'blue', className = '' }) {
  return (
    <span className={`ui-icon-box ${ICON_TONES[tone] || ''} ${className}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

function DcimMetricCard({ icon, tone = 'blue', label, value, hint }) {
  return (
    <div className="dcim-card flex min-h-[104px] items-center justify-between gap-3 p-4">
      <div>
        <div className="text-sm font-bold text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-black leading-none text-slate-950">{value}</div>
        <div className="mt-2 text-sm font-semibold text-slate-500">{hint}</div>
      </div>
      <IconFrame icon={icon} tone={tone} className="h-11 w-11 shrink-0" />
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = status || 'active';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
        STATUS_STYLES[normalized] || STATUS_STYLES.offline
      }`}
    >
      {STATUS_LABELS[normalized] || normalized}
    </span>
  );
}

export default function DcimView({
  datacenters,
  activeLocation,
  setActiveLocation,
  setCurrentDcForm,
  setIsDcModalOpen,
  handleDownloadTemplate,
  handleImportClick,
  isImporting,
  handleExportExcel,
  setCurrentRackForm,
  setIsRackModalOpen,
  racks,
  currentRacks,
  setSelectedRack,
  handleDeleteRack,
  setEditingDevice,
  rackDevices,
  dataErrors = {},
  isDataLoading = false,
  systemCounts = null,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRackFilter, setSelectedRackFilter] = useState('');
  const [showRoomOverview, setShowRoomOverview] = useState(false);
  const [showRackMatrix, setShowRackMatrix] = useState(false);

  const datacenterList = asArray(datacenters);
  const allRacks = asArray(racks);
  const rackList = asArray(currentRacks);
  const allDevices = asArray(rackDevices);
  const currentDatacenter =
    datacenterList.find((item) => String(item.id) === String(activeLocation)) || null;
  const datacenterMap = useMemo(
    () => new Map(datacenterList.map((item) => [String(item.id), item])),
    [datacenterList],
  );
  const visibleRacks = activeLocation ? rackList : allRacks;

  useEffect(() => {
    setSelectedRackFilter('');
  }, [activeLocation]);

  const dcimErrors = Object.values(dataErrors).filter(Boolean);
  const databaseDatacenterCount = safeInt(systemCounts?.datacenters, 0);
  const hasCountMismatch =
    dcimErrors.length === 0 &&
    datacenterList.length === 0 &&
    databaseDatacenterCount > 0;
  const reportsEmptyDatabase =
    dcimErrors.length === 0 &&
    datacenterList.length === 0 &&
    systemCounts &&
    databaseDatacenterCount === 0;

  const devicesByRack = useMemo(() => {
    const grouped = new Map();
    allDevices.forEach((device) => {
      const rackId = String(device.rack);
      if (!grouped.has(rackId)) grouped.set(rackId, []);
      grouped.get(rackId).push(device);
    });
    return grouped;
  }, [allDevices]);

  const rows = useMemo(() => {
    const result = [];
    visibleRacks.forEach((rack) => {
      const devices = (devicesByRack.get(String(rack.id)) || [])
        .sort((a, b) => safeInt(b.position) - safeInt(a.position));
      if (devices.length === 0) {
        result.push({ rack, device: null });
        return;
      }
      devices.forEach((device) => result.push({ rack, device }));
    });
    return result;
  }, [devicesByRack, visibleRacks]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter(({ rack, device }) => {
      if (selectedRackFilter && String(rack.id) !== String(selectedRackFilter)) {
        return false;
      }
      if (statusFilter !== 'all' && (device?.status || 'empty') !== statusFilter) {
        return false;
      }
      if (!query) return true;
      return [
        datacenterMap.get(String(rack.datacenter))?.name,
        datacenterMap.get(String(rack.datacenter))?.location,
        rack.code,
        rack.name,
        device?.name,
        device?.device_type,
        device?.brand,
        device?.model,
        device?.mgmt_ip,
        device?.project,
        device?.contact,
        device?.asset_tag,
        device?.sn,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [datacenterMap, rows, searchQuery, selectedRackFilter, statusFilter]);

  const summary = useMemo(() => {
    const currentDevices = rows.filter((row) => row.device).map((row) => row.device);
    return {
      racks: visibleRacks.length,
      devices: currentDevices.length,
      ratedPower: currentDevices.reduce((sum, device) => sum + safeInt(device.power_usage), 0),
      typicalPower: currentDevices.reduce((sum, device) => sum + safeInt(device.typical_power), 0),
    };
  }, [rows, visibleRacks.length]);

  const datacenterSummaries = useMemo(() => {
    return datacenterList.map((datacenter) => {
      const dcRacks = allRacks.filter((rack) => String(rack.datacenter) === String(datacenter.id));
      const dcDevices = dcRacks.flatMap((rack) => devicesByRack.get(String(rack.id)) || []);
      const ratedPower = dcDevices.reduce((sum, device) => sum + safeInt(device.power_usage), 0);
      const totalU = dcRacks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
      const usedU = dcDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
      return {
        datacenter,
        racks: dcRacks.length,
        devices: dcDevices.length,
        ratedPower,
        utilization: totalU ? Math.round((usedU / totalU) * 100) : 0,
      };
    });
  }, [allRacks, datacenterList, devicesByRack]);

  const globalSummary = useMemo(() => {
    const totalU = allRacks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
    const usedU = allDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
    return {
      datacenters: datacenterList.length,
      racks: allRacks.length,
      devices: allDevices.length,
      utilization: totalU ? Math.round((usedU / totalU) * 100) : 0,
      ratedPower: allDevices.reduce((sum, device) => sum + safeInt(device.power_usage), 0),
    };
  }, [allDevices, allRacks, datacenterList.length]);

  const rackTiles = useMemo(() => {
    return visibleRacks
      .map((rack) => {
        const devices = devicesByRack.get(String(rack.id)) || [];
        const usedU = devices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
        const height = safeInt(rack.height, 42);
        const utilization = height ? Math.min(100, Math.round((usedU / height) * 100)) : 0;
        const ratedPower = devices.reduce((sum, device) => sum + safeInt(device.power_usage), 0);
        const powerLimit = safeInt(rack.power_limit, 0);
        const isPowerOver = powerLimit > 0 && ratedPower > powerLimit;
        const isHot = utilization >= 85 || isPowerOver;
        const isWarn = !isHot && utilization >= 70;
        const datacenter = datacenterMap.get(String(rack.datacenter));
        return {
          rack,
          datacenter,
          devices,
          usedU,
          height,
          utilization,
          ratedPower,
          isPowerOver,
          tone: isHot ? 'danger' : isWarn ? 'warn' : devices.length ? 'normal' : 'empty',
        };
      })
      .sort((a, b) => {
        const dcCompare = String(a.datacenter?.name || '').localeCompare(String(b.datacenter?.name || ''), 'zh-Hans-CN', { numeric: true });
        if (dcCompare !== 0) return dcCompare;
        return String(a.rack.code || a.rack.name || '').localeCompare(String(b.rack.code || b.rack.name || ''), 'zh-Hans-CN', { numeric: true });
      });
  }, [datacenterMap, devicesByRack, visibleRacks]);

  const focusRackTiles = useMemo(() => {
    return rackTiles
      .filter((tile) => tile.devices.length > 0)
      .slice()
      .sort((a, b) => {
        if (b.utilization !== a.utilization) return b.utilization - a.utilization;
        return b.ratedPower - a.ratedPower;
      })
      .slice(0, 8);
  }, [rackTiles]);

  const openCreateDatacenter = () => {
    setCurrentDcForm({ name: '', location: '', contact_phone: '' });
    setIsDcModalOpen(true);
  };

  const openEditDatacenter = () => {
    if (!currentDatacenter) return;
    setCurrentDcForm(currentDatacenter);
    setIsDcModalOpen(true);
  };

  const openCreateRack = () => {
    if (!activeLocation) return;
    setCurrentRackForm({
      datacenter: activeLocation,
      code: '',
      name: '',
      height: 42,
      power_limit: 0,
      pdu_count: 2,
      pdu_power: 0,
      description: '',
    });
    setIsRackModalOpen(true);
  };

  const openEditRack = (rack) => {
    setCurrentRackForm(rack);
    setIsRackModalOpen(true);
  };

  const openCreateDevice = (rack) => {
    setSelectedRack(rack);
    setEditingDevice({ rack: rack.id });
  };

  const openEditDevice = (rack, device) => {
    setSelectedRack(rack);
    setEditingDevice(device);
  };

  const openRowEditor = (rack, device) => {
    if (device) {
      openEditDevice(rack, device);
      return;
    }
    openEditRack(rack);
  };

  if (!activeLocation) {
    return (
      <div className="dcim-page custom-scrollbar h-full overflow-y-auto p-5 lg:p-6">
        <div className="mx-auto max-w-[1880px] space-y-5">
          {dcimErrors.length > 0 || hasCountMismatch || reportsEmptyDatabase ? (
            <div
              className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
                reportsEmptyDatabase
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-rose-200 bg-rose-50 text-rose-950'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <div className="font-black">机房数据需要确认</div>
                  <div className="mt-1 text-sm leading-6 opacity-80">
                    {dcimErrors.length > 0
                      ? dcimErrors
                          .map((error) => `${error.url}: HTTP ${error.status || '连接失败'} ${error.message}`)
                          .join('；')
                      : hasCountMismatch
                        ? `系统总览报告 ${databaseDatacenterCount} 个机房，但列表接口未返回数据。`
                        : '当前数据库报告机房数量为 0，请先核对数据挂载。'}
                  </div>
                </div>
              </div>
              <ToolbarButton icon={RefreshCw} label="重新读取" onClick={onRefresh} busy={isDataLoading} />
            </div>
          ) : null}

          <section className="dcim-card overflow-hidden p-6 lg:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 text-sm font-black text-blue-600">
                  <IconFrame icon={LayoutDashboard} className="h-10 w-10" />
                  机房设备总览
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950">
                  先看全局容量，再进入单个机房维护资产
                </h2>
                <p className="mt-3 text-base font-semibold leading-7 text-slate-500">
                  总页只保留机房入口、容量使用和风险提示；进入机房后再处理机柜、设备和导入导出，页面会更聚焦。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ToolbarButton icon={RefreshCw} label="刷新" onClick={onRefresh} busy={isDataLoading} />
                <ToolbarButton icon={Plus} label="新增机房" onClick={openCreateDatacenter} primary />
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <DcimMetricCard
              icon={Building2}
              label="机房总数"
              value={globalSummary.datacenters}
              hint={`${globalSummary.racks} 个机柜`}
            />
            <DcimMetricCard
              icon={HardDrive}
              tone="green"
              label="纳管设备"
              value={globalSummary.devices}
              hint="来自机房资产台账"
            />
            <DcimMetricCard
              icon={Gauge}
              tone="amber"
              label="U 位利用率"
              value={`${globalSummary.utilization}%`}
              hint="按所有机柜容量汇总"
            />
            <DcimMetricCard
              icon={Zap}
              tone="rose"
              label="额定功率"
              value={`${globalSummary.ratedPower} W`}
              hint="设备额定功率合计"
            />
          </section>

          <section className="dcim-card p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">机房入口</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  每个机房作为一个工作区，点击进入后再查看机柜矩阵和设备明细。
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                {datacenterSummaries.length} 个机房
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {datacenterSummaries.map(({ datacenter, racks: rackCount, devices: deviceCount, ratedPower, utilization }) => (
                <button
                  key={datacenter.id}
                  type="button"
                  onClick={() => {
                    setSelectedRackFilter('');
                    setActiveLocation(datacenter.id);
                  }}
                  className="dcim-room-card group p-5 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <IconFrame icon={Building2} className="h-11 w-11 shrink-0" />
                    <ChevronRight className="mt-2 h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                  </div>
                  <div className="mt-5 min-w-0">
                    <div className="truncate text-xl font-black text-slate-950">{datacenter.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{datacenter.location || '未填写位置'}</span>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-xs font-bold text-slate-400">机柜</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{rackCount}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-xs font-bold text-slate-400">设备</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{deviceCount}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-xs font-bold text-slate-400">U 位</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{utilization}%</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${utilization >= 85 ? 'bg-rose-500' : utilization >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    />
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-500">额定功率 {ratedPower} W</div>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="dcim-card p-5 lg:p-6">
              <div className="flex items-center gap-3">
                <IconFrame icon={ShieldAlert} tone="amber" className="h-11 w-11" />
                <div>
                  <h3 className="text-xl font-black text-slate-950">容量关注</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">按 U 位利用率和功率排序，优先看到最需要处理的机柜。</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {focusRackTiles.length > 0 ? (
                  focusRackTiles.map((tile) => (
                    <button
                      key={tile.rack.id}
                      type="button"
                      onClick={() => {
                        setSelectedRackFilter(tile.rack.id);
                        setActiveLocation(tile.rack.datacenter);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-slate-950">
                            {tile.datacenter?.name || '未分配机房'} / {tile.rack.code || tile.rack.name || '未编号机柜'}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-500">
                            {tile.devices.length} 台设备，{tile.usedU}/{tile.height}U
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                          {tile.utilization}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${tile.tone === 'danger' ? 'bg-rose-500' : tile.tone === 'warn' ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${tile.utilization}%` }}
                        />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
                    暂无机柜容量数据。
                  </div>
                )}
              </div>
            </div>

            <div className="dcim-card p-5 lg:p-6">
              <div className="flex items-center gap-3">
                <IconFrame icon={Boxes} tone="green" className="h-11 w-11" />
                <div>
                  <h3 className="text-xl font-black text-slate-950">资产维护入口</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">常用动作放在总页，批量维护时不用先进入某个机房。</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ToolbarButton icon={Download} label="下载模板" onClick={() => handleDownloadTemplate('dcim')} />
                <ToolbarButton icon={Upload} label="导入资产" onClick={() => handleImportClick('dcim')} busy={isImporting} />
                <ToolbarButton icon={FileSpreadsheet} label="导出 Excel" onClick={() => handleExportExcel('dcim')} />
                <ToolbarButton icon={RefreshCw} label="刷新数据" onClick={onRefresh} busy={isDataLoading} />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="dcim-page flex h-full min-h-0 flex-col gap-3 p-3 lg:p-4">
      {dcimErrors.length > 0 || hasCountMismatch || reportsEmptyDatabase ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
            reportsEmptyDatabase
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-rose-200 bg-rose-50 text-rose-950'
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <div className="font-black">
                {dcimErrors.length > 0
                  ? '机房数据接口读取失败'
                  : hasCountMismatch
                    ? '数据库计数与机房列表不一致'
                    : '当前数据库报告机房数量为 0'}
              </div>
              <div className="mt-1 text-sm leading-6 opacity-80">
                {dcimErrors.length > 0
                  ? dcimErrors
                      .map((error) => `${error.url}：HTTP ${error.status || '连接失败'}，${error.message}`)
                      .join('；')
                  : hasCountMismatch
                    ? `系统总览报告 ${databaseDatacenterCount} 个机房，但列表接口未返回数据。`
                    : '请先核对 Docker 的 data/mysql 挂载，暂时不要新增或覆盖资产。'}
              </div>
            </div>
          </div>
          <ToolbarButton icon={RefreshCw} label="重新读取" onClick={onRefresh} busy={isDataLoading} />
        </div>
      ) : null}

      <section className="dcim-compact-bar shrink-0 p-2.5">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="custom-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedRackFilter('');
                setActiveLocation(null);
              }}
              className={`dcim-room-tab flex shrink-0 items-center gap-3 px-3 py-2 text-left transition ${
                !activeLocation ? 'dcim-room-tab--active' : 'hover:border-blue-300/40 hover:text-blue-100'
              }`}
            >
              <ArrowLeft className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-black">全部机房</span>
              <span className="text-xs font-bold text-slate-500">
                {globalSummary.datacenters} 机房 · {globalSummary.racks} 机柜 · {globalSummary.devices} 设备
              </span>
            </button>

            {datacenterSummaries.map(({ datacenter, racks: rackCount, devices: deviceCount, utilization }) => {
              const isActive = String(activeLocation || '') === String(datacenter.id);
              return (
                <button
                  key={datacenter.id}
                  type="button"
                  onClick={() => {
                    setSelectedRackFilter('');
                    setActiveLocation(datacenter.id);
                  }}
                  className={`dcim-room-tab flex shrink-0 items-center gap-3 px-3 py-2 text-left transition ${
                    isActive ? 'dcim-room-tab--active' : 'hover:border-blue-300/40 hover:text-blue-100'
                  }`}
                >
                  <span className="max-w-[180px] truncate text-sm font-black">{datacenter.name}</span>
                  <span className="whitespace-nowrap text-xs font-bold text-slate-500">
                    {rackCount} 机柜 · {deviceCount} 设备 · U {utilization}%
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowRoomOverview((current) => !current)}
            className="ui-secondary-button inline-flex h-9 shrink-0 items-center justify-center px-3 text-xs font-black transition"
          >
            {showRoomOverview ? '收起概览' : '展开概览'}
          </button>
        </div>

        {showRoomOverview ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="text-xs font-black text-blue-700">全部资源</div>
              <div className="mt-1 text-lg font-black text-slate-950">{globalSummary.racks} 机柜 / {globalSummary.devices} 设备</div>
              <div className="text-xs text-slate-500">U 位利用 {globalSummary.utilization}%</div>
            </div>
            {datacenterSummaries.map(({ datacenter, racks: rackCount, devices: deviceCount, ratedPower, utilization }) => (
              <div key={datacenter.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="truncate text-xs font-black text-slate-500">{datacenter.location || '未填写位置'}</div>
                <div className="mt-1 truncate text-lg font-black text-slate-950">{datacenter.name}</div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs font-bold text-slate-600">
                  <span>{rackCount} 机柜</span>
                  <span>{deviceCount} 设备</span>
                  <span>{ratedPower}W / {utilization}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="dcim-room-workbench dcim-card shrink-0 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
              <FileSpreadsheet className="h-4 w-4" />
              机房资产台账
            </div>
            <div className="mt-0.5 text-xl font-black text-slate-950">
              {currentDatacenter?.name || '全部机房总览'}
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              {currentDatacenter?.location || '先用机柜矩阵看状态，再用下方台账精确维护资产信息'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolbarButton icon={Plus} label="新增机房" onClick={openCreateDatacenter} />
            <ToolbarButton
              icon={Edit3}
              label="编辑机房"
              onClick={openEditDatacenter}
              disabled={!currentDatacenter}
            />
            <ToolbarButton icon={Download} label="下载模板" onClick={() => handleDownloadTemplate('dcim')} />
            <ToolbarButton icon={Upload} label="导入资产" onClick={() => handleImportClick('dcim')} busy={isImporting} />
            <ToolbarButton icon={FileSpreadsheet} label="导出 Excel" onClick={() => handleExportExcel('dcim')} />
            <ToolbarButton icon={Plus} label="新增机柜" onClick={openCreateRack} primary disabled={!activeLocation} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['机柜', summary.racks],
            ['设备', summary.devices],
            ['额定功率', `${summary.ratedPower} W`],
            ['典型功率', `${summary.typicalPower} W`],
          ].map(([label, value]) => (
            <span key={label} className="dcim-room-summary-chip rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">
              {label}
              <span className="ml-2 text-sm font-black text-slate-900">{value}</span>
            </span>
          ))}
        </div>

        <div className={`dcim-rack-matrix-panel mt-3 rounded-xl border border-slate-200 bg-slate-50/60 ${showRackMatrix ? 'p-2.5' : 'px-2.5 py-2'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-900">机柜矩阵看板</div>
              <div className="mt-0.5 text-xs text-slate-500">
                默认收起保留一行入口，展开后查看全部机柜；点击机柜可过滤下方台账。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
                共 {rackTiles.length} 个机柜
              </span>
              {selectedRackFilter ? (
                <button
                  type="button"
                  onClick={() => setSelectedRackFilter('')}
                  className="ui-secondary-button rounded-xl px-3 py-2 text-xs font-bold"
                >
                  清除机柜过滤
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowRackMatrix((current) => !current)}
                className="ui-secondary-button rounded-xl px-3 py-2 text-xs font-bold"
              >
                {showRackMatrix ? '收起矩阵' : '展开矩阵'}
              </button>
            </div>
          </div>

          <div
            className={
              showRackMatrix
                ? 'mt-3 grid max-h-60 grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2 overflow-auto pr-1'
                : 'custom-scrollbar mt-2 flex max-h-12 gap-2 overflow-x-auto pb-1'
            }
          >
            {(showRackMatrix ? rackTiles : rackTiles.slice(0, 12)).map((tile) => {
              const isSelected = String(selectedRackFilter || '') === String(tile.rack.id);
              const isAlertTone = tile.tone === 'danger' || tile.tone === 'warn';
              if (!showRackMatrix) {
                return (
                  <button
                    key={tile.rack.id}
                    type="button"
                    onClick={() => setSelectedRackFilter(isSelected ? '' : tile.rack.id)}
                    className={`dcim-rack-chip flex min-w-[142px] items-center justify-between gap-3 px-3 py-1.5 text-left text-xs font-bold transition ${
                      isSelected ? 'dcim-rack-chip--active' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-100">{tile.rack.code || tile.rack.name || '未编号机柜'}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {tile.devices.length} 台 · {tile.usedU}/{tile.height}U
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-black ${
                        tile.tone === 'danger'
                          ? 'bg-rose-500/20 text-rose-100'
                          : tile.tone === 'warn'
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'bg-blue-500/15 text-blue-100'
                      }`}
                    >
                      {tile.utilization}%
                    </span>
                  </button>
                );
              }
              const toneClass =
                tile.tone === 'danger'
                  ? 'border-rose-400/70 bg-rose-600 text-white'
                  : tile.tone === 'warn'
                    ? 'border-amber-400/70 bg-amber-500 text-white'
                    : tile.tone === 'empty'
                      ? 'border-slate-700 bg-slate-900/55 text-slate-400'
                      : 'border-blue-400/30 bg-blue-500/15 text-slate-100';
              const barClass =
                tile.tone === 'danger'
                  ? 'bg-white'
                  : tile.tone === 'warn'
                    ? 'bg-white'
                    : tile.tone === 'empty'
                      ? 'bg-slate-600'
                      : 'bg-blue-400';
              const trackClass = isAlertTone ? 'bg-white/25' : 'bg-slate-950/30';
              const badgeClass = isAlertTone ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-100';
              return (
                <button
                  key={tile.rack.id}
                  type="button"
                  onClick={() => setSelectedRackFilter(isSelected ? '' : tile.rack.id)}
                  className={`dcim-rack-tile border p-2.5 text-left ${showRackMatrix ? '' : 'min-w-[124px]'} ${toneClass} ${
                    isSelected ? 'dcim-rack-tile--active' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{tile.rack.code || tile.rack.name || '未编号机柜'}</div>
                      <div className="mt-0.5 truncate text-xs opacity-70">
                        {activeLocation ? tile.rack.name || '标准机柜' : tile.datacenter?.name || '未分配机房'}
                      </div>
                    </div>
                    <div className={`rounded-full px-1.5 py-0.5 text-[11px] font-black ${badgeClass}`}>{tile.devices.length}</div>
                  </div>
                  <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${trackClass}`}>
                    <div className={`h-full rounded-full ${barClass}`} style={{ width: `${tile.utilization}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold opacity-80">
                    <span>{tile.usedU}/{tile.height}U</span>
                    <span>{tile.ratedPower}W</span>
                  </div>
                  {tile.isPowerOver ? (
                    <div className="mt-1.5 rounded-lg bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">功率超限</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="dcim-table-shell flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dcim-table-toolbar flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <select
            value={activeLocation || ''}
            onChange={(event) => {
              setSelectedRackFilter('');
              setActiveLocation(event.target.value || null);
            }}
            className="min-w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">全部机房总览</option>
            {datacenterList.map((datacenter) => (
              <option key={datacenter.id} value={datacenter.id}>
                {datacenter.name}
              </option>
            ))}
          </select>

          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索机柜、设备、IP、项目、负责人、资产编号..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="active">运行中</option>
            <option value="maintenance">维护中</option>
            <option value="offline">离线</option>
            <option value="planned">规划中</option>
            <option value="retired">已退役</option>
            <option value="empty">空机柜</option>
          </select>

          <div className="text-sm font-semibold text-slate-500">显示 {filteredRows.length} 行</div>
          <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            双击行编辑；右侧操作栏始终固定
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
          <table className="min-w-[2420px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 text-left text-xs font-black text-slate-600">
              <tr>
                {[
                  '序号', '机房', '机柜编号', '机柜名称', '高度(U)', 'PDU数', 'PDU实测(W)',
                  '设备名称', '起始U', '占用U', '设备类型', '品牌', '型号', '管理IP',
                  '项目名称', '负责人', '状态', '额定功率(W)', '典型功率(W)',
                  '固定资产编号', '序列号(SN)', '操作',
                ].map((label, index) => (
                  <th
                    key={label}
                    className={`whitespace-nowrap border-b border-r border-slate-200 px-3 py-3 ${
                      index < 4 ? 'sticky z-30 bg-slate-100' : ''
                    } ${index === 21 ? 'sticky right-0 z-40 border-l bg-slate-100 text-center shadow-[-8px_0_16px_-14px_rgba(15,23,42,0.45)]' : ''}`}
                    style={
                      index === 0
                        ? { left: 0 }
                        : index === 1
                          ? { left: 56 }
                          : index === 2
                            ? { left: 168 }
                            : index === 3
                              ? { left: 280 }
                              : index === 21
                                ? { right: 0 }
                                : undefined
                    }
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ rack, device }, index) => (
                <tr
                  key={`${rack.id}-${device?.id || 'empty'}`}
                  className="group cursor-pointer hover:bg-blue-50/50"
                  title={device ? '双击编辑设备' : '双击编辑机柜'}
                  onDoubleClick={() => openRowEditor(rack, device)}
                >
                  <td className="sticky left-0 z-10 w-14 border-b border-r border-slate-200 bg-white px-3 py-2.5 text-center text-slate-400 group-hover:bg-blue-50">
                    {index + 1}
                  </td>
                  <td className="sticky left-14 z-10 w-28 border-b border-r border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-700 group-hover:bg-blue-50">
                    {datacenterMap.get(String(rack.datacenter))?.name || '-'}
                  </td>
                  <td className="sticky left-[168px] z-10 w-28 border-b border-r border-slate-200 bg-white px-3 py-2.5 font-black text-slate-800 group-hover:bg-blue-50">
                    {rack.code || '-'}
                  </td>
                  <td className="sticky left-[280px] z-10 w-44 border-b border-r border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-700 group-hover:bg-blue-50">
                    {rack.name || '-'}
                  </td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{safeInt(rack.height, 42)}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{safeInt(rack.pdu_count, 2)}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{safeInt(rack.pdu_power)}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-800">
                    {device?.name || <span className="text-slate-400">空机柜</span>}
                  </td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{device ? safeInt(device.position, 1) : '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{device ? safeInt(device.u_height, 1) : '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.device_type || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.brand || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.model || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 font-mono text-xs">{device?.mgmt_ip || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.project || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.contact || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">
                    {device ? <StatusBadge status={device.status} /> : <span className="text-slate-400">空</span>}
                  </td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{device ? safeInt(device.power_usage) : '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right">{device ? safeInt(device.typical_power) : '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.asset_tag || '-'}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2.5">{device?.sn || '-'}</td>
                  <td className="sticky right-0 z-20 border-b border-l border-slate-200 bg-white px-2 py-2.5 shadow-[-8px_0_16px_-14px_rgba(15,23,42,0.45)] group-hover:bg-blue-50">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditRack(rack)}
                        title="编辑机柜"
                        className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-blue-700"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openCreateDevice(rack)}
                        title="新增设备"
                        className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-emerald-700"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {device ? (
                        <button
                          type="button"
                          onClick={() => openEditDevice(rack, device)}
                          title="编辑设备"
                          className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-blue-700"
                        >
                          <Server className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => handleDeleteRack(rack.id, event)}
                        title="删除机柜"
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isDataLoading && currentDatacenter && filteredRows.length === 0 ? (
            <div className="ui-empty-state flex min-h-64 items-center justify-center text-center text-slate-400">
              <div>
                <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
                <div className="mt-3 font-bold text-slate-600">没有匹配的资产记录</div>
                <div className="mt-1 text-sm">可调整筛选条件，或新增机柜后导入设备。</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
