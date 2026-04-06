import React from 'react';
import { Folder } from 'lucide-react';

export default function IpamEmptyState() {
  return (
    <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white px-10 py-20 text-center shadow-sm">
      <div>
        <Folder className="mx-auto h-14 w-14 text-slate-300" />
        <h3 className="mt-5 text-3xl font-black text-slate-700">先从左侧选择业务分组和子网。</h3>
        <p className="mt-2 text-base text-slate-500">选中后就能查看地址台账、地址池分布，以及导入导出工具。</p>
      </div>
    </div>
  );
}
