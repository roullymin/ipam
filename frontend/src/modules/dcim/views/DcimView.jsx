import React from 'react';
import {
  AlignJustify,
  Calculator,
  Code,
  Columns,
  FileText,
  Folder,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Maximize,
  Plus,
  Upload,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import RackElevation from '../../../components/RackElevation';
import { DcimRackCard, DcimRackSidebar } from '../components';

const TEXT = {
  areaTitle: '机房列表',
  areaHint: '选择一个机房，查看机柜容量和立面详情。',
  addDatacenter: '新增机房',
  locationFallback: '未填写位置',
  overviewEyebrow: '容量与电力总览',
  cardView: '卡片视图',
  elevationView: '立面视图',
  downloadTemplate: '下载模板',
  importAssets: '导入资产',
  exportExcel: 'Excel',
  exportHtml: 'HTML',
  exportImage: '导出图片',
  readonlyOverview: '只读总览',
  addRack: '新增机柜',
  rackCount: '机柜数',
  deviceCount: '设备数',
  plannedPower: '规划功率',
  actualPower: '实际功率',
  utilization: '利用率',
  freeUnits: '剩余 U 位',
  standardRack: '标准机柜',
  noDatacenter: '请先选择机房',
  noDatacenterHint: '选中机房后，这里会展示该机房的总览、机柜卡片和立面布局。',
  noRacks: '该机房还没有机柜',
  noRacksHint: '先新增机柜，再继续放置设备和维护位置信息。',
  rackCodeFallback: '未命名机柜',
  detail: '查看详情',
  rackElevation: '机柜立面',
  rackElevationHint: '当前采用紧凑缩放，便于在屏幕上浏览机柜立面。',
  zoomOut: '缩小',
  zoomIn: '放大',
  zoomReset: '重置缩放',
  closeDetail: '关闭机柜详情',
  deviceList: '设备列表',
  deviceListHint: '设备按 U 位从高到低排序。',
  emptyDevices: '该机柜还没有设备',
  emptyDevicesHint: '新增设备后即可追踪机柜位置、功率和责任信息。',
  addDevice: '新增设备',
  unnamedDevice: '未命名设备',
  noMgmtIp: '未填写管理 IP',
  noProject: '未关联项目',
  noOwner: '未填写责任人',
  ratedPower: '额定功率',
  project: '项目',
  owner: '责任人',
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
          ? 'inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-700'
          : 'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50'
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
    <div className={`rounded-[24px] border px-4 py-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-[24px] font-black leading-none">{value}</span>
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
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition-all ${
        active
          ? 'border-cyan-300 bg-cyan-50 shadow-sm'
          : 'border-transparent bg-white hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50'
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
    datacenterPowerStats,
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

  const elevationScale = Math.max(0.5, Math.min(viewState?.scale || 0.7, 0.92));
  const elevationCardWidth = Math.max(220, Math.round(280 * elevationScale));
  const elevationUnitHeight = Math.max(16, Math.round(22 * elevationScale));

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
    <div className="flex h-full min-h-0 gap-5 bg-slate-50/60 p-5">
      <aside className="flex h-full w-[248px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
              <MapPin className="h-4 w-4" />
              {TEXT.areaTitle}
            </div>
            <div className="mt-3 text-[15px] font-black leading-7 tracking-tight text-slate-900">
              {TEXT.areaHint}
            </div>
          </div>
          <button
            onClick={handleCreateDatacenter}
            type="button"
            title={TEXT.addDatacenter}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-transparent bg-white text-cyan-700 shadow-sm transition-colors hover:bg-cyan-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
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

      <section className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="rounded-[30px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                <MapPin className="h-4 w-4" />
                {TEXT.overviewEyebrow}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <h1 className="text-[26px] font-black leading-none tracking-tight text-slate-950 xl:text-[30px]">
                  {currentDatacenter?.name || TEXT.noDatacenter}
                </h1>
                <span className="pb-0.5 text-sm text-slate-500">{currentDatacenter?.location || ''}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:items-end">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex rounded-[22px] border border-slate-200 bg-slate-50 p-1 shadow-sm">
                  <button
                    onClick={() => setDcimViewMode('card')}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-bold ${
                      dcimViewMode === 'card'
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                        : 'text-slate-600'
                    }`}
                  >
                    <Columns className="h-4 w-4" />
                    {TEXT.cardView}
                  </button>
                  <button
                    onClick={() => setDcimViewMode('elevation')}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-bold ${
                      dcimViewMode === 'elevation'
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
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

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricTile icon={HardDrive} label={TEXT.rackCount} value={metrics.rackCount} tone="blue" />
                <MetricTile icon={Server} label={TEXT.deviceCount} value={metrics.deviceCount} />
                <MetricTile icon={Calculator} label={TEXT.plannedPower} value={metrics.totalPlanned} unit="W" />
                <MetricTile icon={Zap} label={TEXT.actualPower} value={metrics.totalActual} unit="W" tone="emerald" />
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {!currentDatacenter ? (
            <div className="h-full">
              <EmptyState icon={MapPin} title={TEXT.noDatacenter} hint={TEXT.noDatacenterHint} />
            </div>
          ) : dcimViewMode === 'card' ? (
            <div className="custom-scrollbar h-full overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
              {rackList.length ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {rackList.map((rack) => {
                    const devices = allDevices.filter((item) => String(item.rack) === String(rack.id));
                    const computed = getRackCalculatedPower ? getRackCalculatedPower(rack.id) : 0;
                    const plannedPower = resolvePlannedPower(computed || rack.power_limit || rack.planned_power || 0);
                    const actualPower = extractRackMeta(rack).actualPower;
                    return (
                      <DcimRackCard
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
                        text={TEXT}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={HardDrive} title={TEXT.noRacks} hint={TEXT.noRacksHint} />
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <div className="text-base font-black text-slate-900">{TEXT.rackElevation}</div>
                  <div className="mt-1 text-sm text-slate-500">{TEXT.rackElevationHint}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={TEXT.zoomOut}
                    onClick={handleZoomOut}
                    className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={TEXT.zoomIn}
                    onClick={handleZoomIn}
                    className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={TEXT.zoomReset}
                    onClick={handleZoomReset}
                    className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
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
                                {safeInt(rack.height, 42)}U · {devices.length} 台设备
                              </div>
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

      <DcimRackSidebar
        rack={selectedRack}
        devices={selectedRackDevices}
        plannedPower={selectedRack ? getRackCalculatedPower?.(selectedRack.id) : 0}
        onClose={() => setSelectedRack(null)}
        onAddDevice={() => setEditingDevice({ rack: selectedRack?.id })}
        onEditDevice={(device) => setEditingDevice(device)}
        text={TEXT}
      />
    </div>
  );
}

