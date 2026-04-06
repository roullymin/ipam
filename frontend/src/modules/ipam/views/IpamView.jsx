import React, { useMemo } from 'react';
import { Edit2, Filter } from 'lucide-react';

import ListToolbar from '../../../components/common/ListToolbar';
import {
  IpamEmptyState,
  IpamSectionSidebar,
  IpListTable,
  IpPoolPanel,
  SubnetWorkspaceHeader,
} from '../components';

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return Object.values(value);
  return [];
};

export default function IpamView(props) {
  const {
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
  } = props;

  const sectionList = safeArray(sections);
  const subnetList = safeArray(subnets);
  const tagOptions = safeArray(uniqueTags);
  const currentSubnetData = currentSubnet || {};
  const currentSubnetId = currentSubnetData.id;
  const currentSubnetIPs = useMemo(() => safeArray(filteredIPs), [filteredIPs]);

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
      <IpamSectionSidebar
        sections={sectionList}
        expandedSections={expandedSections}
        selectedSubnetId={selectedSubnetId}
        subnets={subnetList}
        setExpandedSections={setExpandedSections}
        setSectionFormData={setSectionFormData}
        setIsSectionModalOpen={setIsSectionModalOpen}
        setSubnetFormData={setSubnetFormData}
        setIsSubnetModalOpen={setIsSubnetModalOpen}
        handleDeleteSection={handleDeleteSection}
        setSelectedSubnetId={setSelectedSubnetId}
        handleDeleteSubnet={handleDeleteSubnet}
      />

      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        {currentSubnetId ? (
          <>
            <SubnetWorkspaceHeader
              currentSubnetData={currentSubnetData}
              metrics={metrics}
              ipViewMode={ipViewMode}
              setIpViewMode={setIpViewMode}
              handleScanSubnet={handleScanSubnet}
              isScanning={isScanning}
              handleDownloadTemplate={handleDownloadTemplate}
              handleImportClick={handleImportClick}
              isImporting={isImporting}
              handleExport={handleExport}
              onOpenCreateIP={handleOpenCreateIP}
            />

            <ListToolbar
              eyebrow="列表工具栏"
              title="搜索、筛选和快捷操作"
              description="统一把地址搜索、标签筛选和子网维护入口收在同一层，减少在列表上方反复找按钮。"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="搜索 IP、设备名称、负责人或说明"
              resultSummary={`当前结果 ${currentSubnetIPs.length} / ${metrics.total}`}
              filters={
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="bg-transparent font-medium outline-none">
                    <option value="">全部标签</option>
                    {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </div>
              }
              actions={
                <button onClick={() => { setSubnetFormData(currentSubnetData); setIsSubnetModalOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50" type="button">
                  <Edit2 className="h-4 w-4" />
                  编辑子网
                </button>
              }
            />

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              {ipViewMode === 'list' ? (
                <IpListTable ips={currentSubnetIPs} optionLists={optionLists} onEdit={handleOpenEditIP} onDelete={handleDeleteIP} />
              ) : (
                <IpPoolPanel ips={currentSubnetIPs} subnetId={currentSubnetId} onIPClick={handlePoolIPClick} />
              )}
            </div>
          </>
        ) : (
          <IpamEmptyState />
        )}
      </section>
    </div>
  );
}
