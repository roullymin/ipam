import React from 'react';
import { Folder, Plus } from 'lucide-react';

import IpamSectionCard from './IpamSectionCard';

export default function IpamSectionSidebar({
  sections,
  expandedSections,
  selectedSubnetId,
  subnets,
  setExpandedSections,
  setSectionFormData,
  setIsSectionModalOpen,
  setSubnetFormData,
  setIsSubnetModalOpen,
  handleDeleteSection,
  setSelectedSubnetId,
  handleDeleteSubnet,
}) {
  return (
    <section className="flex w-[288px] flex-shrink-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
        <div>
          <div className="flex items-center gap-2 text-blue-600">
            <Folder className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wide">业务网段分组</span>
          </div>
          <h2 className="mt-3 text-[18px] font-black leading-8 tracking-tight text-slate-900">先选分组，再看子网和地址状态。</h2>
        </div>
        <button onClick={() => { setSectionFormData({}); setIsSectionModalOpen(true); }} className="rounded-2xl bg-slate-100 p-4 text-blue-600 transition-colors hover:bg-blue-50" title="新增分组" type="button">
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-4">
          {sections.map((section) => (
            <IpamSectionCard
              key={section.id}
              section={section}
              expanded={!!expandedSections[section.id]}
              subnets={subnets.filter((subnet) => subnet.section === section.id)}
              selectedSubnetId={selectedSubnetId}
              onToggle={() => setExpandedSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
              onCreateSubnet={() => { setSubnetFormData({ section: section.id }); setIsSubnetModalOpen(true); }}
              onDeleteSection={() => handleDeleteSection(section.id)}
              onSelectSubnet={setSelectedSubnetId}
              onDeleteSubnet={handleDeleteSubnet}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
