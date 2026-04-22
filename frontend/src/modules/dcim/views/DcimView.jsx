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
  Server,
  Upload,
  Zap,
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
  elevationWindow: '立面新窗口',
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
  rackElevationHint: '这里改成机柜立面的清爽预览，完整立面会在新窗口里单独打开，浏览和滚轮体验更稳定。',
  elevationWindowHint: '新窗口会隐藏后台操作区，专门用于浏览机柜立面和给他人展示。',
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
          ? 'inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_100%)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(14,165,233,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(14,165,233,0.3)]'
          : 'inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/92 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-800'
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
      ? 'border-blue-100 bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)] text-blue-700'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-[linear-gradient(180deg,#f5fffb_0%,#ecfbf3_100%)] text-emerald-700'
        : 'border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-900';

  return (
    <div className={`rounded-[26px] border px-4 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)] ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
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
          ? 'border-cyan-200 bg-[linear-gradient(135deg,#f1fbff_0%,#ecfdf8_100%)] shadow-[0_14px_28px_rgba(8,145,178,0.1)]'
          : 'border-white/70 bg-white/84 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-black tracking-tight text-slate-900">{datacenter.name}</div>
          <div className="mt-1.5 text-sm text-slate-500">{datacenter.location || TEXT.locationFallback}</div>
        </div>
        <div className="rounded-full border border-slate-100 bg-white px-3 py-1 text-sm font-bold text-slate-500 shadow-sm">
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

  const openReadonlyOverview = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('dc-overview', '1');
    if (activeLocation) url.searchParams.set('datacenter', String(activeLocation));
    window.open(url.toString(), '_blank');
  };

  const openElevationWindow = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('dc-elevation', '1');
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
    <div className="flex h-full min-h-0 gap-5 bg-[radial-gradient(circle_at_top_left,rgba(186,230,253,0.26),transparent_26%),linear-gradient(180deg,#f8fbfe_0%,#f1f5f9_100%)] p-5">
      <aside className="flex h-full w-[272px] flex-col overflow-hidden rounded-[32px] border border-white/80 bg-white/82 shadow-[0_24px_52px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,#f6fcff_0%,#eefaf8_100%)] px-5 py-5">
          <div className="flex items-start justify-between gap-3">
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
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white text-cyan-700 shadow-sm transition-colors hover:bg-cyan-50"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4 rounded-[24px] border border-slate-100 bg-slate-50/70 px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{TEXT.overviewEyebrow}</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{rackList.length}</div>
            <div className="mt-1 text-sm text-slate-500">{TEXT.rackCount}</div>
          </div>
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
        <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/86 shadow-[0_24px_52px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-5 p-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
            <div className="rounded-[28px] border border-slate-100 bg-[linear-gradient(135deg,#f8fdff_0%,#eef9ff_44%,#eefaf5_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                <MapPin className="h-4 w-4" />
                {TEXT.overviewEyebrow}
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <h1 className="text-[30px] font-black leading-none tracking-tight text-slate-950 xl:text-[34px]">
                  {currentDatacenter?.name || TEXT.noDatacenter}
                </h1>
                <span className="pb-1 text-sm font-medium text-slate-500">{currentDatacenter?.location || ''}</span>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                统一查看当前机房的机柜容量、设备规模、电力状态和排位分布，支持卡片视图与立面视图快速切换。
              </p>

              <div className="mt-5 inline-flex rounded-[22px] border border-white/90 bg-white/84 p-1.5 shadow-sm">
                <button
                  onClick={() => setDcimViewMode('card')}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold ${
                    dcimViewMode === 'card'
                      ? 'bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_100%)] text-white shadow-md shadow-cyan-600/20'
                      : 'text-slate-600'
                  }`}
                >
                  <Columns className="h-4 w-4" />
                  {TEXT.cardView}
                </button>
                <button
                  onClick={() => setDcimViewMode('elevation')}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold ${
                    dcimViewMode === 'elevation'
                      ? 'bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_100%)] text-white shadow-md shadow-cyan-600/20'
                      : 'text-slate-600'
                  }`}
                >
                  <AlignJustify className="h-4 w-4" />
                  {TEXT.elevationView}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5 rounded-[28px] border border-slate-100 bg-slate-50/80 p-4">
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
            <div className="custom-scrollbar h-full overflow-y-auto rounded-[32px] border border-slate-200/80 bg-white/86 p-5 shadow-[0_24px_52px_rgba(15,23,42,0.08)] backdrop-blur">
              {rackList.length ? (
                <div className="mb-5 rounded-[26px] border border-slate-100 bg-[linear-gradient(135deg,#fbfdff_0%,#f3f8fd_100%)] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Rack Canvas</div>
                      <div className="mt-2 text-2xl font-black text-slate-950">机柜卡片视图</div>
                      <div className="mt-1 text-sm text-slate-500">适合快速比较容量、负载和 PDU 状态。</div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
                      当前机柜 {rackList.length} 台
                    </div>
                  </div>
                </div>
              ) : null}
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
            <div className="custom-scrollbar h-full overflow-y-auto rounded-[32px] border border-slate-200/80 bg-white/86 p-5 shadow-[0_24px_52px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-4 rounded-[26px] border border-slate-100 bg-[linear-gradient(135deg,#fbfdff_0%,#f4f8fe_52%,#eef7ff_100%)] px-5 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-base font-black text-slate-900">{TEXT.rackElevation}</div>
                    <div className="mt-1 text-sm text-slate-500">{TEXT.rackElevationHint}</div>
                    <div className="mt-3 text-sm leading-6 text-slate-500">{TEXT.elevationWindowHint}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton icon={Maximize} label={TEXT.elevationWindow} onClick={openElevationWindow} primary />
                    <ActionButton icon={Columns} label={TEXT.cardView} onClick={() => setDcimViewMode('card')} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {rackList.length ? (
                  rackList.map((rack) => {
                    const devices = allDevices.filter((item) => String(item.rack) === String(rack.id));
                    return (
                      <button
                        key={rack.id}
                        onClick={() => setSelectedRack(rack)}
                        type="button"
                        className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                              {rack.code || TEXT.rackCodeFallback}
                            </div>
                            <div className="mt-3 text-[22px] font-black text-slate-900">{rack.name}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {safeInt(rack.height, 42)}U · {devices.length} 台设备
                            </div>
                          </div>
                          <div className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-bold text-cyan-700">
                            {TEXT.detail}
                          </div>
                        </div>

                        <div className="overflow-x-auto pb-1">
                          <RackElevation
                            rack={rack}
                            devices={devices}
                            onSelect={setSelectedRack}
                            onEdit={setEditingDevice}
                            readonly
                            showHeader={false}
                            unitHeight={18}
                          />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-full flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center text-slate-400">
                    <div>
                      <HardDrive className="mx-auto h-10 w-10 text-slate-300" />
                      <div className="mt-4 text-xl font-black text-slate-900">{TEXT.noRacks}</div>
                      <div className="mt-2 text-sm text-slate-500">{TEXT.noRacksHint}</div>
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

