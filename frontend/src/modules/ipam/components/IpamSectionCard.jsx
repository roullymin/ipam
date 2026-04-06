import React from 'react';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2 } from 'lucide-react';

export default function IpamSectionCard({
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
      <div className="group flex cursor-pointer items-center justify-between gap-3 px-3 py-3" onClick={onToggle}>
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          <Folder className="h-4 w-4 text-blue-500" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">{section.name}</div>
            <div className="text-xs text-slate-400">{subnets.length} 个子网</div>
          </div>
        </div>
        <div className="hidden items-center gap-1 group-hover:flex">
          <button onClick={(event) => { event.stopPropagation(); onCreateSubnet(); }} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" type="button" title="新增子网">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={(event) => { event.stopPropagation(); onDeleteSection(); }} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" type="button" title="删除分组">
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
                  isActive ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white'
                }`}
                type="button"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold">{subnet.cidr}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{subnet.name || '未命名子网'}</div>
                </div>
                <span onClick={(event) => { event.stopPropagation(); onDeleteSubnet(subnet.id); }} className="hidden rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600 group-hover/subnet:block">
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
          {subnets.length === 0 ? <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">这个分组下还没有子网。</div> : null}
        </div>
      ) : null}
    </div>
  );
}
