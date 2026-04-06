import React from 'react';
import { Edit2, Server } from 'lucide-react';

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default function DcimRackDeviceRow({ device, onEdit, text }) {
  const height = Math.max(1, safeInt(device.u_height, 1));
  const top = safeInt(device.position, 1);
  const bottom = top - height + 1;
  const positionLabel = height === 1 ? `${top}U` : `${Math.max(1, bottom)}-${top}`;

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <div className="text-lg font-black leading-none">{height}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em]">{positionLabel}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-slate-400" />
                <h4 className="truncate text-[17px] font-black tracking-tight text-slate-900">
                  {device.name || text.unnamedDevice}
                </h4>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {device.device_type || text.unclassified}
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-mono text-blue-700">
                  {device.mgmt_ip || text.noMgmtIp}
                </span>
              </div>
            </div>
            <button
              onClick={() => onEdit(device)}
              type="button"
              title={text.editDevice}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold uppercase tracking-wider text-slate-400">{text.ratedPower}</div>
              <div className="mt-1 text-sm font-bold text-slate-800">{safeInt(device.power_usage, 0)}W</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold uppercase tracking-wider text-slate-400">{text.project}</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-800">{device.project || text.noProject}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold uppercase tracking-wider text-slate-400">{text.owner}</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-800">{device.contact || text.noOwner}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
