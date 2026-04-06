import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default function DcimRackCard({
  rack,
  devices,
  plannedPower,
  actualPower,
  onSelect,
  onEdit,
  onDelete,
  text,
}) {
  const rackHeight = safeInt(rack.height, 42);
  const occupied = devices.reduce((sum, item) => sum + Math.max(1, safeInt(item.u_height, 1)), 0);
  const freeUnits = Math.max(0, rackHeight - occupied);
  const utilization = rackHeight > 0 ? Math.min(100, Math.round((occupied / rackHeight) * 100)) : 0;
  const barClass =
    utilization >= 85 ? 'bg-red-500' : utilization >= 65 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div
      onClick={() => onSelect(rack)}
      className="group cursor-pointer overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
            {rack.code || text.rackCodeFallback}
          </div>
          <h3 className="mt-2 truncate text-[18px] font-black tracking-tight text-slate-900">{rack.name}</h3>
          <div className="mt-1 text-sm text-slate-500">
            {rackHeight}U {text.standardRack}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onEdit(rack);
            }}
            type="button"
            title={text.editRack}
            className="rounded-2xl border border-slate-200 p-2 text-slate-400 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(event) => onDelete(rack.id, event)}
            type="button"
            title={text.deleteRack}
            className="rounded-2xl border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-500">
          <span>{text.utilization}</span>
          <span>{utilization}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${utilization}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{text.deviceCount}</div>
            <div className="mt-1 text-lg font-black text-slate-900">{devices.length}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{text.freeUnits}</div>
            <div className="mt-1 text-lg font-black text-slate-900">{freeUnits}U</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{text.plannedPower}</div>
            <div className="mt-1 text-lg font-black text-slate-900">{plannedPower}W</div>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">PDU</div>
            <div className="mt-1 text-lg font-black">{actualPower}W</div>
          </div>
        </div>
      </div>
    </div>
  );
}
