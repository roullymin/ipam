import React from 'react';
import { Plus } from 'lucide-react';

import ResidentSummaryCard from './ResidentSummaryCard';

export default function ResidentOverview({ stats, onOpenCreate }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">驻场人员管理</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            统一管理驻场申请、设备备案、审批状态和签批导出，同时为公开扫码登记提供标准化入口。
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-700"
          type="button"
        >
          <Plus className="mr-2 h-5 w-5" />
          新增驻场人员
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <ResidentSummaryCard title="在册人数" value={stats.total} />
        <ResidentSummaryCard title="已通过" value={stats.approved} tone="text-emerald-600" />
        <ResidentSummaryCard title="待审核" value={stats.pending} tone="text-amber-600" />
        <ResidentSummaryCard title="即将到期" value={stats.expiringSoon} tone="text-rose-600" />
        <ResidentSummaryCard title="待安排座位" value={stats.needsSeat} tone="text-cyan-600" />
      </div>
    </>
  );
}
