import React from 'react';
import { Plus } from 'lucide-react';

import ResidentSummaryCard from './ResidentSummaryCard';

export default function ResidentOverview({ stats, onOpenCreate }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-slate-900">驻场人员管理</h2>
          <p className="mt-1 max-w-3xl truncate text-xs text-slate-500">
            统一管理驻场申请、设备备案、审批状态和签批导出，同时为公开扫码登记提供标准化入口。
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="flex h-9 items-center rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition hover:bg-blue-700"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          新增驻场人员
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <ResidentSummaryCard title="在册人数" value={stats.total} />
        <ResidentSummaryCard title="已通过" value={stats.approved} tone="text-emerald-600" />
        <ResidentSummaryCard title="待审核" value={stats.pending} tone="text-amber-600" />
        <ResidentSummaryCard title="即将到期" value={stats.expiringSoon} tone="text-rose-600" />
        <ResidentSummaryCard title="待安排座位" value={stats.needsSeat} tone="text-blue-600" />
      </div>
    </>
  );
}
