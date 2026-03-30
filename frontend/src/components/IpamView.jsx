import React, { useMemo } from 'react';
import {
  Activity,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  FileText,
  Filter,
  Folder,
  Grid as GridIcon,
  List as ListIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  Wifi,
} from 'lucide-react';
import IPPoolGrid from './IPPoolGrid';
import { StatusBadge } from './common/UI';

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return Object.values(value);
  return [];
};

function ActionButton({ icon: Icon, label, onClick, primary = false, busy = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/15 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none'
          : 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'
      }
      type="button"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function MetricTile({ icon: Icon, label, value, unit = '', accent = 'default' }) {
  const accentClass = {
    default: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-[20px] border px-4 py-4 shadow-sm ${accentClass[accent] || accentClass.default}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-[30px] font-black leading-none">{value}</span>
        {unit ? <span className="pb-1 text-base font-bold opacity-60">{unit}</span> : null}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  expanded,
  subnets,
  selectedSubnetId,
  onToggle,
  onCreateSubnet,
  onDeleteSection,
  onSelectSubnet,
  onDeleteSubnet,
}) {
  return (
    <div className="rounded-[22px] border border-transparent bg-white transition-all hover:border-slate-200 hover:bg-slate-50">
      <div
        className="group flex cursor-pointer items-center justify-between gap-3 px-3 py-3"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
          )}
          <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">{section.name}</div>
            <div className="text-xs text-slate-400">{subnets.length} 个网段</div>
          </div>
        </div>
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onCreateSubnet();
            }}
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
            type="button"
            title="新增网段"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDeleteSection();
            }}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
            type="button"
            title="删除分组"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-2 border-t border-slate-100 px-3 py-3">
          {subnets.map((subnet) => {
            const isActive = String(selectedSubnetId) === String(subnet.id);
            return (
              <button
                key={subnet.id}
                onClick={() => onSelectSubnet(subnet.id)}
                className={`group/subnet flex w-full items-start justify-between rounded-[18px] border px-3 py-3 text-left transition-all ${
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white'
                }`}
                type="button"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold">{subnet.cidr}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{subnet.name || '未命名网段'}</div>
                </div>
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteSubnet(subnet.id);
                  }}
                  className="hidden rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600 group-hover/subnet:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
          {subnets.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
              该分组下还没有网段
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SubnetInfo({ title, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{value || '-'}</div>
    </div>
  );
}

function IpListTable({
  ips,
  optionLists,
  onEdit,
  onDelete,
}) {
  const deviceTypes = safeArray(optionLists?.deviceTypes);

  const resolveDeviceType = (value) => {
    const matched = deviceTypes.find((item) => {
      if (typeof item === 'object') return item.value === value;
      return item === value;
    });
    if (!matched) return value || '-';
    return typeof matched === 'object' ? matched.label : matched;
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="custom-scrollbar overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">IP 地址</th>
              <th className="px-5 py-3 font-semibold">状态</th>
              <th className="px-5 py-3 font-semibold">设备名称</th>
              <th className="px-5 py-3 font-semibold">设备类型</th>
              <th className="px-5 py-3 font-semibold">负责人</th>
              <th className="px-5 py-3 font-semibold">NAT</th>
              <th className="px-5 py-3 font-semibold">标签</th>
              <th className="px-5 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ips.map((ip) => (
              <tr key={ip.id} className="group hover:bg-blue-50/40">
                <td className="px-5 py-4 font-mono font-bold text-slate-900">{ip.ip_address}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={ip.status} isLocked={ip.is_locked} />
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-900">{ip.device_name || '未登记设备'}</div>
                  <div className="mt-1 max-w-[260px] truncate text-xs text-slate-400">
                    {ip.description || '暂无说明'}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">{resolveDeviceType(ip.device_type)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{ip.owner || '-'}</td>
                <td className="px-5 py-4">
                  {ip.nat_type && ip.nat_type !== 'none' ? (
                    <div
                      className="inline-flex items-center rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                      title={`映射到 ${ip.nat_ip || '-'}:${ip.nat_port || '-'}`}
                    >
                      <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                      {ip.nat_ip || '已配置'}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">未配置</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {ip.tag ? (
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      <Tag className="mr-1.5 h-3.5 w-3.5" />
                      {ip.tag}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">无标签</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onEdit(ip)}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      type="button"
                      title="编辑地址"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(ip.id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      type="button"
                      title="删除地址"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function IpamView({
  sections,
  expandedSections,
  setExpandedSections,
  setSectionFormData,
  setIsSectionModalOpen,
  setSubnetFormData,
  setIsSubnetModalOpen,
  handleDeleteSection,
  subnets,
  selectedSubnetId,
  setSelectedSubnetId,
  handleDeleteSubnet,
  currentSubnet,
  ipViewMode,
  setIpViewMode,
  handleScanSubnet,
  isScanning,
  setIpFormData,
  setEditingIP,
  setIsIPModalOpen,
  searchQuery,
  setSearchQuery,
  tagFilter,
  setTagFilter,
  uniqueTags,
  handleDownloadTemplate,
  handleImportClick,
  isImporting,
  handleExport,
  filteredIPs,
  optionLists,
  handleDeleteIP,
  handlePoolIPClick,
}) {
  const sectionList = safeArray(sections);
  const subnetList = safeArray(subnets);
  const tagOptions = safeArray(uniqueTags);
  const currentSubnetData = currentSubnet || {};
  const currentSubnetId = currentSubnetData.id;

  const currentSubnetIPs = useMemo(
    () => safeArray(filteredIPs),
    [filteredIPs],
  );

  const metrics = useMemo(() => {
    const total = currentSubnetIPs.length;
    const active = currentSubnetIPs.filter((item) => ['online', 'active'].includes(item.status)).length;
    const reserved = currentSubnetIPs.filter((item) => item.status === 'reserved').length;
    return { total, active, reserved };
  }, [currentSubnetIPs]);

  const handleOpenCreateIP = () => {
    setIpFormData({});
    setEditingIP(null);
    setIsIPModalOpen(true);
  };

  const handleOpenEditIP = (ip) => {
    setEditingIP(ip);
    setIpFormData(ip);
    setIsIPModalOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 gap-6 overflow-hidden">
      <section className="flex w-[288px] flex-shrink-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
          <div>
            <div className="flex items-center gap-2 text-blue-600">
              <Folder className="h-5 w-5" />
              <span className="text-sm font-bold tracking-wide">业务网段分组</span>
            </div>
            <h2 className="mt-3 text-[18px] font-black leading-8 tracking-tight text-slate-900">
              选择分组后查看网段与地址状态
            </h2>
          </div>
          <button
            onClick={() => {
              setSectionFormData({});
              setIsSectionModalOpen(true);
            }}
            className="rounded-2xl bg-slate-100 p-4 text-blue-600 transition-colors hover:bg-blue-50"
            title="新增分组"
            type="button"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          <div className="space-y-4">
            {sectionList.map((section) => {
              const sectionSubnets = subnetList.filter((subnet) => subnet.section === section.id);
              return (
                <SectionCard
                  key={section.id}
                  section={section}
                  expanded={!!expandedSections[section.id]}
                  subnets={sectionSubnets}
                  selectedSubnetId={selectedSubnetId}
                  onToggle={() =>
                    setExpandedSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                  }
                  onCreateSubnet={() => {
                    setSubnetFormData({ section: section.id });
                    setIsSubnetModalOpen(true);
                  }}
                  onDeleteSection={() => handleDeleteSection(section.id)}
                  onSelectSubnet={setSelectedSubnetId}
                  onDeleteSubnet={handleDeleteSubnet}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        {currentSubnetId ? (
          <>
            <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-blue-600">
                      <MapPin className="h-5 w-5" />
                      <span className="text-sm font-bold tracking-wide">网段台账与地址概览</span>
                    </div>
                    <h1 className="mt-3 text-[30px] font-black leading-none tracking-tight text-slate-950">
                      <span className="font-mono text-blue-600">{currentSubnetData.cidr}</span>
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                      {currentSubnetData.name || '未命名网段'}
                    </p>
                  </div>

                  <div className="grid min-w-[360px] grid-cols-3 gap-3">
                    <MetricTile icon={Wifi} label="地址总数" value={metrics.total} unit="个" accent="blue" />
                    <MetricTile icon={Activity} label="在线地址" value={metrics.active} unit="个" />
                    <MetricTile icon={Tag} label="预留地址" value={metrics.reserved} unit="个" accent="emerald" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <SubnetInfo title="运营商" value={currentSubnetData.isp} />
                  <SubnetInfo title="带宽容量" value={currentSubnetData.bandwidth} />
                  <SubnetInfo title="VLAN ID" value={currentSubnetData.vlan_id} />
                  <SubnetInfo title="物理位置" value={currentSubnetData.location} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIpViewMode('list')}
                        className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-bold transition-colors ${
                          ipViewMode === 'list'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                            : 'text-slate-500 hover:bg-white'
                        }`}
                        type="button"
                      >
                        <ListIcon className="h-4 w-4" />
                        列表视图
                      </button>
                      <button
                        onClick={() => setIpViewMode('pool')}
                        className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-bold transition-colors ${
                          ipViewMode === 'pool'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                            : 'text-slate-500 hover:bg-white'
                        }`}
                        type="button"
                      >
                        <GridIcon className="h-4 w-4" />
                        地址池视图
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <ActionButton icon={RefreshCw} label="扫描存活" onClick={handleScanSubnet} busy={isScanning} disabled={isScanning} />
                    <ActionButton icon={FileText} label="下载模板" onClick={handleDownloadTemplate} />
                    <ActionButton icon={Upload} label="导入地址" onClick={handleImportClick} busy={isImporting} disabled={isImporting} />
                    <ActionButton icon={Download} label="导出 Excel" onClick={handleExport} />
                    <ActionButton icon={Plus} label="新增地址" onClick={handleOpenCreateIP} primary />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full max-w-[420px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="搜索 IP、设备名称或说明"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-blue-300 focus:bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <select
                        value={tagFilter}
                        onChange={(event) => setTagFilter(event.target.value)}
                        className="bg-transparent font-medium outline-none"
                      >
                        <option value="">全部标签</option>
                        {tagOptions.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        setSubnetFormData(currentSubnetData);
                        setIsSubnetModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      type="button"
                    >
                      <Edit2 className="h-4 w-4" />
                      编辑网段
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                {ipViewMode === 'list' ? (
                  <IpListTable
                    ips={currentSubnetIPs}
                    optionLists={optionLists}
                    onEdit={handleOpenEditIP}
                    onDelete={handleDeleteIP}
                  />
                ) : (
                  <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="text-lg font-black text-slate-900">地址池视图</div>
                      <div className="mt-1 text-sm text-slate-500">点击空闲地址可快速录入，点击已用地址可查看或编辑。</div>
                    </div>
                    <div className="custom-scrollbar overflow-auto">
                      <IPPoolGrid
                        ips={currentSubnetIPs}
                        subnetId={currentSubnetId}
                        onIPClick={handlePoolIPClick}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white px-10 py-20 text-center shadow-sm">
            <div>
              <Folder className="mx-auto h-14 w-14 text-slate-300" />
              <h3 className="mt-5 text-3xl font-black text-slate-700">从左侧选择业务分组与网段</h3>
              <p className="mt-2 text-base text-slate-500">选中后即可查看地址台账、地址池分布和导入导出工具。</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
