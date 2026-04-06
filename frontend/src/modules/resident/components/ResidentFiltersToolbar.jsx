import React from 'react';
import { X } from 'lucide-react';

import ListToolbar from '../../../components/common/ListToolbar';
import { FormInput } from '../../../components/common/UI';

export default function ResidentFiltersToolbar({
  filters,
  setFilters,
  approvalOptions,
  activeFilterCount,
  filteredResidentStaff,
  residentStaff,
  onClearFilters,
}) {
  return (
    <ListToolbar
      eyebrow="列表工具栏"
      title="快速筛选"
      description="按姓名、公司、项目、联系电话或设备 MAC 快速过滤当前驻场人员列表。"
      searchValue={filters.name}
      onSearchChange={(value) => setFilters((prev) => ({ ...prev, name: value }))}
      searchPlaceholder="先按姓名快速定位"
      resultSummary={`当前结果 ${filteredResidentStaff.length} / ${residentStaff.length}`}
      actions={
        <button
          onClick={onClearFilters}
          disabled={!activeFilterCount}
          className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          type="button"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          清空筛选
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        <FormInput label="姓名" value={filters.name} onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))} placeholder="例如：金超" />
        <FormInput label="公司" value={filters.company} onChange={(event) => setFilters((prev) => ({ ...prev, company: event.target.value }))} placeholder="例如：数字广东" />
        <FormInput label="项目" value={filters.projectName} onChange={(event) => setFilters((prev) => ({ ...prev, projectName: event.target.value }))} placeholder="例如：一体化平台" />
        <FormInput label="联系电话" value={filters.phone} onChange={(event) => setFilters((prev) => ({ ...prev, phone: event.target.value }))} placeholder="例如：1363" />
        <FormInput label="设备 MAC" value={filters.mac} onChange={(event) => setFilters((prev) => ({ ...prev, mac: event.target.value }))} placeholder="例如：AA:BB 或 11-22" />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">审批状态</label>
          <select value={filters.approvalStatus} onChange={(event) => setFilters((prev) => ({ ...prev, approvalStatus: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <option value="">全部状态</option>
            {approvalOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">座位安排</label>
          <select value={filters.seatStatus} onChange={(event) => setFilters((prev) => ({ ...prev, seatStatus: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <option value="">全部情况</option>
            <option value="needed">需要安排且未落实</option>
            <option value="assigned">已安排座位</option>
            <option value="not_needed">无需座位</option>
          </select>
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-400">
        {activeFilterCount ? `已启用 ${activeFilterCount} 个筛选条件。` : '当前未启用筛选条件。'}
      </div>
    </ListToolbar>
  );
}
