import React from 'react';
import {
  AlignJustify,
  Calculator,
  Code,
  Columns,
  Edit2,
  FileText,
  Folder,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Maximize,
  Plus,
  Server,
  Trash2,
  Upload,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import RackElevation from './RackElevation';

const TEXT = {
  areaTitle: '机房区域',
  areaHint: '选择机房后查看机柜与排位状态',
  addDatacenter: '新增机房',
  locationFallback: '未填写位置说明',
  overviewEyebrow: '机房容量与功耗概览',
  cardView: '卡片视图',
  elevationView: '排位图视图',
  downloadTemplate: '下载模板',
  importAssets: '导入资产',
  exportExcel: 'Excel',
  exportHtml: 'HTML',
  exportImage: '图片',
  readonlyOverview: '只读概览',
  addRack: '新增机柜',
  rackCount: '机柜数量',
  deviceCount: '设备数量',
  plannedPower: '设计总负载',
  actualPower: 'PDU 实测总功率',
  utilization: '空间占用率',
  freeUnits: '剩余空间',
  standardRack: '标准机柜',
  noDatacenter: '请先选择机房',
  noDatacenterHint: '左侧选中机房后，这里会显示机柜概览、功率统计和排位信息。',
  noRacks: '当前机房还没有机柜',
  noRacksHint: '可以先新增机柜，再录入设备和排位信息。',
  rackCodeFallback: '未编号机柜',
  detail: '详情',
  rackElevation: '机柜排位图',
  rackElevationHint: '默认使用更紧凑的比例，优先减少横向滚动，方便直接在屏幕上查看。',
  zoomOut: '缩小排位图',
  zoomIn: '放大排位图',
  zoomReset: '恢复默认缩放',
  closeDetail: '关闭机柜详情',
  deviceList: '设备清单',
  deviceListHint: '按 U 位从高到低排列，可直接查看和编辑设备信息。',
  emptyDevices: '当前机柜还没有设备',
  emptyDevicesHint: '先新增设备，再录入上架位置、功率和项目归属。',
  addDevice: '在此机柜上架设备',
  unnamedDevice: '未命名设备',
  noMgmtIp: '未填写管理地址',
  noProject: '未关联项目',
  noOwner: '未填写负责人',
  ratedPower: '额定功率',
  project: '所属项目',
  owner: '负责人',
  editRack: '编辑机柜',
  deleteRack: '删除机柜',
  editDevice: '编辑设备',
  unclassified: '未分类',
  currentRack: '当前机柜',
};

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

const resolvePlannedPower = (value) => {
  if (typeof value === 'number') return value;
  return safeInt(
    value?.rated_sum ??
      value?.total_rated ??
      value?.planned_power ??
      value?.power_limit ??
      0,
  );
};

const resolveActualPower = (value) => {
  if (typeof value === 'number') return value;
  return safeInt(
    value?.total_pdu ??
      value?.actual_power ??
      value?.pdu_power ??
      0,
  );
};

const extractRackMeta = (rack) => {
  const raw = rack?.description || '';
  const match = raw.match(/__PDU_META__:(\{.*\})/m);
  try {
    const meta = match ? JSON.parse(match[1]) : {};
    return {
      actualPower: safeInt(meta.power ?? rack?.pdu_power ?? rack?.actual_power ?? 0),
      pduCount: safeInt(meta.count ?? rack?.pdu_count ?? 0),
    };
  } catch {
    return {
      actualPower: safeInt(rack?.pdu_power ?? rack?.actual_power ?? 0),
      pduCount: safeInt(rack?.pdu_count ?? 0),
    };
  }
};

function ActionButton({ icon: Icon, label, onClick, primary = false, busy = false }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={
        primary
          ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700'
          : 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function MetricTile({ icon: Icon, label, value, unit = '', tone = 'default' }) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/85 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-[22px] font-black leading-none">{value}</span>
        {unit ? <span className="pb-1 text-sm font-bold opacity-60">{unit}</span> : null}
      </div>
    </div>
  );
}

function DatacenterListItem({ datacenter, rackCount, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(datacenter.id)}
      type="button"
      className={`w-full rounded-[18px] border px-4 py-4 text-left ${
        active
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-black tracking-tight text-slate-900">{datacenter.name}</div>
          <div className="mt-1.5 text-sm text-slate-500">{datacenter.location || TEXT.locationFallback}</div>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-500 shadow-sm">
          {rackCount}
        </div>
      </div>
    </button>
  );
}

function RackCard({ rack, devices, plannedPower, actualPower, onSelect, onEdit, onDelete }) {
  const rackHeight = safeInt(rack.height, 42);
  const occupied = devices.reduce((sum, item) => sum + Math.max(1, safeInt(item.u_height, 1)), 0);
  const freeUnits = Math.max(0, rackHeight - occupied);
  const utilization = rackHeight > 0 ? Math.min(100, Math.round((occupied / rackHeight) * 100)) : 0;
  const barClass =
    utilization >= 85 ? 'bg-red-500' : utilization >= 65 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div
      onClick={() => onSelect(rack)}
      className="group cursor-pointer overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
            {rack.code || TEXT.rackCodeFallback}
          </div>
          <h3 className="mt-2 truncate text-[18px] font-black tracking-tight text-slate-900">{rack.name}</h3>
          <div className="mt-1 text-sm text-slate-500">
            {rackHeight}U {TEXT.standardRack}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onEdit(rack);
            }}
            type="button"
            title={TEXT.editRack}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(event) => onDelete(rack.id, event)}
            type="button"
            title={TEXT.deleteRack}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-500">
          <span>{TEXT.utilization}</span>
          <span>{utilization}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${utilization}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{TEXT.deviceCount}</div>
            <div className="mt-1 text-lg font-black text-slate-900">{devices.length}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{TEXT.freeUnits}</div>
            <div className="mt-1 text-lg font-black text-slate-900">{freeUnits}U</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{TEXT.plannedPower}</div>
            <div className="mt-1 text-lg font-black text-slate-900">{plannedPower}W</div>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">PDU</div>
            <div className="mt-1 text-lg font-black">{actualPower}W</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RackDeviceRow({ device, onEdit }) {
  const height = Math.max(1, safeInt(device.u_height, 1));
  const top = safeInt(device.position, 1);
  const bottom = top - height + 1;
  const positionLabel = height === 1 ? `${top}U` : `${Math.max(1, bottom)}-${top}`;

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <div className="text-lg font-black leading-none">{height}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em]">{positionLabel}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-slate-400" />
                <h4 className="truncate text-[17px] font-black tracking-tight text-slate-900">
                  {device.name || TEXT.unnamedDevice}
                </h4>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {device.device_type || TEXT.unclassified}
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-mono text-blue-700">
                  {device.mgmt_ip || TEXT.noMgmtIp}
                </span>
              </div>
            </div>
            <button
              onClick={() => onEdit(device)}
              type="button"
              title={TEXT.editDevice}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold uppercase tracking-wider text-slate-400">{TEXT.ratedPower}</div>
              <div className="mt-1 text-sm font-bold text-slate-800">{safeInt(device.power_usage, 0)}W</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold uppercase tracking-wider text-slate-400">{TEXT.project}</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-800">{device.project || TEXT.noProject}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold uppercase tracking-wider text-slate-400">{TEXT.owner}</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-800">{device.contact || TEXT.noOwner}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RackSidebar({ rack, devices, plannedPower, onClose, onAddDevice, onEditDevice }) {
  if (!rack) return null;

  const deviceList = asArray(devices);
  const rackHeight = safeInt(rack.height, 42);
  const occupied = deviceList.reduce((sum, item) => sum + Math.max(1, safeInt(item.u_height, 1)), 0);
  const freeUnits = Math.max(0, rackHeight - occupied);
  const utilization = rackHeight > 0 ? Math.min(100, Math.round((occupied / rackHeight) * 100)) : 0;
  const actualPower = extractRackMeta(rack).actualPower;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/25 backdrop-blur-sm">
      <button className="flex-1 cursor-default" onClick={onClose} type="button" aria-label={TEXT.closeDetail} />
      <aside className="relative flex h-full w-[min(360px,88vw)] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {rack.code || TEXT.currentRack}
              </div>
              <h2 className="mt-3 text-[22px] font-black tracking-tight text-slate-900">{rack.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {rackHeight}U {TEXT.standardRack} 路 鍏?{deviceList.length} 鍙拌澶囷紝鍓╀綑 {freeUnits}U
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              title={TEXT.closeDetail}
              className="rounded-2xl border border-slate-200 p-3 text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{TEXT.plannedPower}</div>
              <div className="mt-1 text-lg font-black text-slate-900">{resolvePlannedPower(plannedPower)}W</div>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">{TEXT.actualPower}</div>
              <div className="mt-1 text-lg font-black text-emerald-700">{actualPower}W</div>
            </div>
            <div className="rounded-xl bg-blue-50 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">{TEXT.utilization}</div>
              <div className="mt-1 text-lg font-black text-blue-700">{utilization}%</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{TEXT.deviceCount}</div>
              <div className="mt-1 text-lg font-black text-slate-900">{deviceList.length}鍙?/div>
            </div>
          </div>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black text-slate-900">{TEXT.deviceList}</div>
              <div className="mt-1 text-sm text-slate-500">{TEXT.deviceListHint}</div>
            </div>
            <ActionButton icon={Plus} label={TEXT.addDevice} onClick={onAddDevice} primary />
          </div>
          <div className="space-y-3">
            {deviceList.length ? (
              deviceList.map((device) => (
                <RackDeviceRow key={device.id} device={device} onEdit={onEditDevice} />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-8 py-14 text-center">
                <Server className="mx-auto h-10 w-10 text-slate-300" />
                <div className="mt-4 text-xl font-black text-slate-700">{TEXT.emptyDevices}</div>
                <p className="mt-2 text-sm text-slate-500">{TEXT.emptyDevicesHint}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-10 text-center shadow-sm">
      <div className="max-w-md">
        <Icon className="mx-auto h-12 w-12 text-slate-300" />
        <div className="mt-4 text-2xl font-black text-slate-800">{title}</div>
        <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export default function DcimView(props) {
  const {
    datacenters,
    activeLocation,
    setActiveLocation,
    setCurrentDcForm,
    setIsDcModalOpen,
    dcimViewMode,
    setDcimViewMode,
    handleDownloadTemplate,
    handleImportClick,
    isImporting,
    handleExportExcel,
    handleExportHtml,
    handleExportImage,
    setCurrentRackForm,
    setIsRackModalOpen,
    currentRacks,
    getRackCalculatedPower,
    selectedRack,
    setSelectedRack,
    handleDeleteRack,
    setEditingDevice,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    elevationScrollRef,
    elevationContentRef,
    handleElevationMouseDown,
    handleElevationMouseLeave,
    handleElevationMouseUp,
    handleElevationMouseMove,
    viewState,
    rackDevices,
  } = props;

  const datacenterList = asArray(datacenters);
  const rackList = asArray(currentRacks);
  const allDevices = asArray(rackDevices);
  const currentDatacenter =
    datacenterList.find((item) => String(item.id) === String(activeLocation)) || null;

  const currentDevices = currentDatacenter
    ? allDevices.filter((item) => rackList.some((rack) => String(rack.id) === String(item.rack)))
    : [];

  const selectedRackDevices = selectedRack
    ? [...allDevices]
        .filter((item) => String(item.rack) === String(selectedRack.id))
        .sort((a, b) => safeInt(b.position, 0) - safeInt(a.position, 0))
    : [];

  const metrics = React.useMemo(() => {
    const fallbackPlanned = safeInt(datacenterPowerStats?.total_rated, 0);
    const fallbackActual = safeInt(datacenterPowerStats?.total_pdu, 0);

    const totalPlanned = rackList.reduce((sum, rack) => {
      const computed = getRackCalculatedPower ? getRackCalculatedPower(rack.id) : 0;
      const rackLevel = resolvePlannedPower(computed || rack.power_limit || rack.planned_power || 0);
      if (rackLevel > 0) return sum + rackLevel;
      const rackDevicesList = allDevices.filter((item) => String(item.rack) === String(rack.id));
      return sum + rackDevicesList.reduce((deviceSum, item) => deviceSum + safeInt(item.power_usage, 0), 0);
    }, 0);

    const totalActual = rackList.reduce((sum, rack) => sum + extractRackMeta(rack).actualPower, 0);

    return {
      rackCount: rackList.length,
      deviceCount: currentDevices.length,
      totalPlanned: totalPlanned || fallbackPlanned,
      totalActual: totalActual || fallbackActual,
    };
  }, [allDevices, currentDevices.length, datacenterPowerStats?.total_pdu, datacenterPowerStats?.total_rated, getRackCalculatedPower, rackList]);

  const elevationScale = Math.max(0.44, Math.min(viewState?.scale || 0.62, 0.78));
  const elevationCardWidth = Math.max(126, Math.round(150 * elevationScale));
  const elevationUnitHeight = Math.max(14, Math.round(19 * elevationScale));

  const openReadonlyOverview = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('dc-overview', '1');
    if (activeLocation) url.searchParams.set('datacenter', String(activeLocation));
    window.open(url.toString(), '_blank');
  };

  const handleCreateRack = () => {
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

  const handleCreateDatacenter = () => {
    setCurrentDcForm({ name: '', location: '', description: '' });
    setIsDcModalOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 bg-slate-50/50">
      <aside className="flex h-full w-[220px] flex-col border-r border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
              <MapPin className="h-4 w-4" />
              {TEXT.areaTitle}
            </div>
            <div className="mt-3 text-[14px] font-black leading-7 tracking-tight text-slate-900">
              {TEXT.areaHint}
            </div>
          </div>
          <button
            onClick={handleCreateDatacenter}
            type="button"
            title={TEXT.addDatacenter}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-transparent bg-slate-100 text-blue-600 shadow-sm hover:bg-blue-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-3">
            {datacenterList.map((datacenter) => (
              <DatacenterListItem
                key={datacenter.id}
                datacenter={datacenter}
                rackCount={
                  String(datacenter.id) === String(activeLocation)
                    ? rackList.length
                    : safeInt(datacenter.rack_count, 0)
                }
                active={String(datacenter.id) === String(activeLocation)}
                onSelect={setActiveLocation}
              />
            ))}
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                <MapPin className="h-4 w-4" />
                {TEXT.overviewEyebrow}
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h1 className="text-[24px] font-black leading-none tracking-tight text-slate-950 xl:text-[26px]">
                  {currentDatacenter?.name || TEXT.noDatacenter}
                </h1>
                <span className="pb-0.5 text-sm text-slate-500">{currentDatacenter?.location || ''}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                  <button
                    onClick={() => setDcimViewMode('card')}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                      dcimViewMode === 'card'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-600'
                    }`}
                  >
                    <Columns className="h-4 w-4" />
                    {TEXT.cardView}
                  </button>
                  <button
                    onClick={() => setDcimViewMode('elevation')}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                      dcimViewMode === 'elevation'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-600'
                    }`}
                  >
                    <AlignJustify className="h-4 w-4" />
                    {TEXT.elevationView}
                  </button>
                </div>
                <ActionButton icon={Folder} label={TEXT.downloadTemplate} onClick={handleDownloadTemplate} />
                <ActionButton icon={Upload} label={TEXT.importAssets} onClick={handleImportClick} busy={isImporting} />
                <ActionButton icon={FileText} label={TEXT.exportExcel} onClick={handleExportExcel} />
                <ActionButton icon={Code} label={TEXT.exportHtml} onClick={handleExportHtml} />
                <ActionButton icon={ImageIcon} label={TEXT.exportImage} onClick={handleExportImage} />
                <ActionButton icon={Maximize} label={TEXT.readonlyOverview} onClick={openReadonlyOverview} />
                <ActionButton icon={Plus} label={TEXT.addRack} onClick={handleCreateRack} primary />
              </div>

              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <MetricTile icon={HardDrive} label={TEXT.rackCount} value={metrics.rackCount} unit="涓? tone="blue" />
                <MetricTile icon={Server} label={TEXT.deviceCount} value={metrics.deviceCount} unit="台"W" />
                <MetricTile icon={Zap} label={TEXT.actualPower} value={metrics.totalActual} unit="W" tone="emerald" />
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {!currentDatacenter ? (
            <div className="p-5">
              <EmptyState icon={MapPin} title={TEXT.noDatacenter} hint={TEXT.noDatacenterHint} />
            </div>
          ) : dcimViewMode === 'card' ? (
            <div className="custom-scrollbar h-full overflow-y-auto p-5">
              {rackList.length ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {rackList.map((rack) => {
                    const devices = allDevices.filter((item) => String(item.rack) === String(rack.id));
                    const computed = getRackCalculatedPower ? getRackCalculatedPower(rack.id) : 0;
                    const plannedPower = resolvePlannedPower(computed || rack.power_limit || rack.planned_power || 0);
                    const actualPower = extractRackMeta(rack).actualPower;
                    return (
                      <RackCard
                        key={rack.id}
                        rack={rack}
                        devices={devices}
                        plannedPower={plannedPower}
                        actualPower={actualPower}
                        onSelect={setSelectedRack}
                        onEdit={(payload) => {
                          setCurrentRackForm(payload);
                          setIsRackModalOpen(true);
                        }}
                        onDelete={handleDeleteRack}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={HardDrive} title={TEXT.noRacks} hint={TEXT.noRacksHint} />
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col p-5">
              <div className="mb-3 flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div>
                  <div className="text-base font-black text-slate-900">{TEXT.rackElevation}</div>
                  <div className="mt-1 text-sm text-slate-500">{TEXT.rackElevationHint}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={TEXT.zoomOut}
                    onClick={handleZoomOut}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={TEXT.zoomIn}
                    onClick={handleZoomIn}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={TEXT.zoomReset}
                    onClick={handleZoomReset}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                ref={elevationScrollRef}
                className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[24px] border border-slate-200 bg-slate-950 p-3 shadow-inner"
              >
                {rackList.length ? (
                  <div
                    ref={elevationContentRef}
                    className="grid content-start gap-3"
                    onMouseDown={handleElevationMouseDown}
                    onMouseMove={handleElevationMouseMove}
                    onMouseUp={handleElevationMouseUp}
                    onMouseLeave={handleElevationMouseLeave}
                    style={{
                      cursor: 'grab',
                      gridTemplateColumns: `repeat(auto-fit, minmax(${elevationCardWidth}px, 1fr))`,
                    }}
                  >
                    {rackList.map((rack) => {
                      const devices = allDevices.filter((item) => String(item.rack) === String(rack.id));
                      return (
                        <button
                          key={rack.id}
                          onClick={() => setSelectedRack(rack)}
                          type="button"
                          className="rounded-[20px] border border-white/10 bg-white/5 p-3 text-left hover:border-blue-300/50 hover:bg-white/10"
                        >
                          <div className="flex items-start justify-between gap-3 pb-3">
                            <div>
                              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                                {rack.code || TEXT.rackCodeFallback}
                              </div>
                              <div className="mt-3 text-[17px] font-black text-white">{rack.name}</div>
                              <div className="mt-1 text-sm text-slate-300">
                                {safeInt(rack.height, 42)}U · {devices.length} 台设备                              </div>
                            </div>
                            <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-200">
                              {TEXT.detail}
                            </div>
                          </div>
                          <RackElevation
                            rack={rack}
                            devices={devices}
                            onSelect={setSelectedRack}
                            onEdit={setEditingDevice}
                            unitHeight={elevationUnitHeight}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center text-center text-slate-400">
                    <div>
                      <HardDrive className="mx-auto h-10 w-10 text-slate-500" />
                      <div className="mt-4 text-xl font-black text-white">{TEXT.noRacks}</div>
                      <div className="mt-2 text-sm text-slate-300">{TEXT.noRacksHint}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <RackSidebar
        rack={selectedRack}
        devices={selectedRackDevices}
        plannedPower={selectedRack ? getRackCalculatedPower?.(selectedRack.id) : 0}
        onClose={() => setSelectedRack(null)}
        onAddDevice={() => setEditingDevice({ rack: selectedRack?.id })}
        onEditDevice={(device) => setEditingDevice(device)}
      />
    </div>
  );
}
