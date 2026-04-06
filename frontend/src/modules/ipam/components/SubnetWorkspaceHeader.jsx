import React from 'react';
import {
  Activity,
  FileText,
  Grid as GridIcon,
  List as ListIcon,
  MapPin,
  Plus,
  RefreshCw,
  Tag,
  Upload,
  Download,
  Wifi,
} from 'lucide-react';

import IpamActionButton from './IpamActionButton';
import IpamMetricTile from './IpamMetricTile';
import SubnetInfoCard from './SubnetInfoCard';

export default function SubnetWorkspaceHeader({
  currentSubnetData,
  metrics,
  ipViewMode,
  setIpViewMode,
  handleScanSubnet,
  isScanning,
  handleDownloadTemplate,
  handleImportClick,
  isImporting,
  handleExport,
  onOpenCreateIP,
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-blue-600">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wide">网段台账与地址概览</span>
          </div>
          <h1 className="mt-3 text-[30px] font-black leading-none tracking-tight text-slate-950"><span className="font-mono text-blue-600">{currentSubnetData.cidr}</span></h1>
          <p className="mt-2 text-sm text-slate-500">{currentSubnetData.name || '未命名子网'}</p>
        </div>
        <div className="grid min-w-[360px] grid-cols-3 gap-3">
          <IpamMetricTile icon={Wifi} label="地址总数" value={metrics.total} unit="个" accent="blue" />
          <IpamMetricTile icon={Activity} label="在线地址" value={metrics.active} unit="个" />
          <IpamMetricTile icon={Tag} label="保留地址" value={metrics.reserved} unit="个" accent="emerald" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SubnetInfoCard title="运营商" value={currentSubnetData.isp} />
        <SubnetInfoCard title="带宽容量" value={currentSubnetData.bandwidth} />
        <SubnetInfoCard title="VLAN ID" value={currentSubnetData.vlan_id} />
        <SubnetInfoCard title="物理位置" value={currentSubnetData.location} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-1">
          <div className="flex items-center gap-1">
            <button onClick={() => setIpViewMode('list')} className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-bold transition-colors ${ipViewMode === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-500 hover:bg-white'}`} type="button">
              <ListIcon className="h-4 w-4" />
              列表视图
            </button>
            <button onClick={() => setIpViewMode('pool')} className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-bold transition-colors ${ipViewMode === 'pool' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-500 hover:bg-white'}`} type="button">
              <GridIcon className="h-4 w-4" />
              地址池视图
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <IpamActionButton icon={RefreshCw} label="扫描存活" onClick={handleScanSubnet} busy={isScanning} disabled={isScanning} />
          <IpamActionButton icon={FileText} label="下载模板" onClick={handleDownloadTemplate} />
          <IpamActionButton icon={Upload} label="导入地址" onClick={handleImportClick} busy={isImporting} disabled={isImporting} />
          <IpamActionButton icon={Download} label="导出 Excel" onClick={handleExport} />
          <IpamActionButton icon={Plus} label="新增地址" onClick={onOpenCreateIP} primary />
        </div>
      </div>
    </div>
  );
}
