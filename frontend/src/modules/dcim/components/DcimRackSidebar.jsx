import React from 'react';
import { Plus, Server, X } from 'lucide-react';

import DcimRackDeviceRow from './DcimRackDeviceRow';

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return Object.values(value);
  return [];
};

const resolvePlannedPower = (value) => {
  if (typeof value === 'number') return value;
  return safeInt(
    value?.rated_sum ??
      value?.total_rated ??
      value?.planned_power ??
      value?.power_limit ??
      0,
  );
};

const extractRackMeta = (rack) => {
  const raw = rack?.description || '';
  const match = raw.match(/__PDU_META__:(\{.*\})/m);
  try {
    const meta = match ? JSON.parse(match[1]) : {};
    return {
      actualPower: safeInt(meta.power ?? rack?.pdu_power ?? rack?.actual_power ?? 0),
      pduCount: safeInt(meta.count ?? rack?.pdu_count ?? 0),
    };
  } catch {
    return {
      actualPower: safeInt(rack?.pdu_power ?? rack?.actual_power ?? 0),
      pduCount: safeInt(rack?.pdu_count ?? 0),
    };
  }
};

function SidebarActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_100%)] px-3.5 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(14,165,233,0.24)] transition-all hover:-translate-y-0.5"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function DcimRackSidebar({
  rack,
  devices,
  plannedPower,
  onClose,
  onAddDevice,
  onEditDevice,
  text,
}) {
  if (!rack) return null;

  const deviceList = asArray(devices);
  const rackHeight = safeInt(rack.height, 42);
  const occupied = deviceList.reduce((sum, item) => sum + Math.max(1, safeInt(item.u_height, 1)), 0);
  const freeUnits = Math.max(0, rackHeight - occupied);
  const utilization = rackHeight > 0 ? Math.min(100, Math.round((occupied / rackHeight) * 100)) : 0;
  const actualPower = extractRackMeta(rack).actualPower;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/25 backdrop-blur-sm">
      <button className="flex-1 cursor-default" onClick={onClose} type="button" aria-label={text.closeDetail} />
      <aside className="relative flex h-full w-[min(400px,90vw)] flex-col border-l border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {rack.code || text.currentRack}
              </div>
              <h2 className="mt-3 text-[22px] font-black tracking-tight text-slate-900">{rack.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {rackHeight}U {text.standardRack} - {deviceList.length} devices - {freeUnits}U free
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              title={text.closeDetail}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-400 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-[20px] border border-sky-100 bg-white px-3.5 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{text.plannedPower}</div>
              <div className="mt-1 text-lg font-black text-slate-900">{resolvePlannedPower(plannedPower)}W</div>
            </div>
            <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/80 px-3.5 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">{text.actualPower}</div>
              <div className="mt-1 text-lg font-black text-emerald-700">{actualPower}W</div>
            </div>
            <div className="rounded-[20px] border border-blue-100 bg-blue-50/80 px-3.5 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">{text.utilization}</div>
              <div className="mt-1 text-lg font-black text-blue-700">{utilization}%</div>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{text.deviceCount}</div>
              <div className="mt-1 text-lg font-black text-slate-900">{deviceList.length}</div>
            </div>
          </div>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black text-slate-900">{text.deviceList}</div>
              <div className="mt-1 text-sm text-slate-500">{text.deviceListHint}</div>
            </div>
            <SidebarActionButton icon={Plus} label={text.addDevice} onClick={onAddDevice} />
          </div>
          <div className="space-y-3">
            {deviceList.length ? (
              deviceList.map((device) => (
                <DcimRackDeviceRow key={device.id} device={device} onEdit={onEditDevice} text={text} />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-8 py-14 text-center">
                <Server className="mx-auto h-10 w-10 text-slate-300" />
                <div className="mt-4 text-xl font-black text-slate-700">{text.emptyDevices}</div>
                <p className="mt-2 text-sm text-slate-500">{text.emptyDevicesHint}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
