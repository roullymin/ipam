import React from 'react';

const TEXT = {
  empty: '空闲',
  overflow: '越界',
  unnamed: '未命名设备',
  managementIp: '管理地址',
  rackElevation: '机柜排位',
};

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

function EmptyUnit({ unit, onClick, unitHeight, readonly }) {
  const baseClass =
    'flex w-full items-center justify-between border-b border-slate-300/70 bg-white/95 px-3 text-[11px] transition-colors';
  const interactiveClass = readonly
    ? 'text-slate-300'
    : 'text-slate-400 hover:bg-blue-50 hover:text-blue-500';

  if (readonly) {
    return (
      <div className={`${baseClass} ${interactiveClass}`} style={{ height: `${unitHeight}px` }}>
        <span>{unit}</span>
        <span className="font-medium">{TEXT.empty}</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      type="button"
      className={`${baseClass} ${interactiveClass}`}
      style={{ height: `${unitHeight}px` }}
    >
      <span>{unit}</span>
      <span className="font-medium">{TEXT.empty}</span>
    </button>
  );
}

function DeviceUnit({ rack, device, top, bottom, height, clipped, onSelect, onEdit, unitHeight, readonly }) {
  const powerUsage = safeInt(device.power_usage, 0);
  const powerTone = powerUsage >= 800 ? 'text-amber-200' : 'text-slate-200';
  const blockClass = clipped
    ? 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500'
    : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500';
  const title = `${device.name || TEXT.unnamed}\nU 位: ${height === 1 ? top : `${bottom}-${top}`}\n${TEXT.managementIp}: ${
    device.mgmt_ip || '-'
  }`;
  const sizeStyle = { height: `${height * unitHeight + Math.max(0, height - 1)}px` };

  if (readonly) {
    return (
      <div title={title} className={`relative flex w-full flex-col items-center justify-center overflow-hidden border border-white/70 px-3 text-center text-white shadow-sm ${blockClass}`} style={sizeStyle}>
        {clipped ? (
          <span className="absolute right-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            {TEXT.overflow}
          </span>
        ) : null}
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-85">
          {height === 1 ? `${top}U` : `${bottom}-${top}`}
        </div>
        <div className="mt-2 line-clamp-2 text-sm font-black leading-5">{device.name || TEXT.unnamed}</div>
        {powerUsage > 0 ? <div className={`mt-2 text-xs font-bold ${powerTone}`}>{powerUsage}W</div> : null}
      </div>
    );
  }

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(rack);
        onEdit?.(device);
      }}
      type="button"
      title={title}
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden border border-white/70 px-3 text-center text-white shadow-sm transition-colors ${blockClass}`}
      style={sizeStyle}
    >
      {clipped ? (
        <span className="absolute right-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          {TEXT.overflow}
        </span>
      ) : null}

      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-85">
        {height === 1 ? `${top}U` : `${bottom}-${top}`}
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-black leading-5">{device.name || TEXT.unnamed}</div>
      {powerUsage > 0 ? <div className={`mt-2 text-xs font-bold ${powerTone}`}>{powerUsage}W</div> : null}
    </button>
  );
}

export default function RackElevation({
  rack,
  devices,
  onSelect,
  onEdit,
  unitHeight = 34,
  readonly = false,
  showHeader = true,
  className = '',
}) {
  const totalUnits = safeInt(rack.height, 42);
  const deviceList = Array.isArray(devices) ? devices : [];
  const renderedUnits = new Set();
  const rows = [];

  for (let unit = totalUnits; unit >= 1; unit -= 1) {
    if (renderedUnits.has(unit)) continue;

    const anchorDevice = deviceList.find((item) => safeInt(item.position, 0) === unit);
    if (anchorDevice) {
      const top = safeInt(anchorDevice.position, unit);
      const height = Math.max(1, safeInt(anchorDevice.u_height, 1));
      const bottom = top - height + 1;

      for (let index = 0; index < height; index += 1) {
        const occupiedUnit = top - index;
        if (occupiedUnit >= 1) renderedUnits.add(occupiedUnit);
      }

      rows.push(
        <DeviceUnit
          key={`${anchorDevice.id || anchorDevice.name}-${unit}`}
          rack={rack}
          device={anchorDevice}
          top={top}
          bottom={Math.max(1, bottom)}
          height={height}
          clipped={top > totalUnits || bottom < 1}
          onSelect={onSelect}
          onEdit={onEdit}
          unitHeight={unitHeight}
          readonly={readonly}
        />,
      );
      continue;
    }

    const overlappingDevice = deviceList.find((item) => {
      const top = safeInt(item.position, 0);
      const height = Math.max(1, safeInt(item.u_height, 1));
      const bottom = top - height + 1;
      return top > totalUnits && unit <= top && unit >= bottom;
    });

    if (overlappingDevice) {
      const top = safeInt(overlappingDevice.position, unit);
      const height = Math.max(1, safeInt(overlappingDevice.u_height, 1));
      const bottom = top - height + 1;
      const visibleBottom = Math.max(1, bottom);
      const visibleHeight = top - visibleBottom + 1;

      for (let index = 0; index < visibleHeight; index += 1) {
        renderedUnits.add(top - index);
      }

      rows.push(
        <DeviceUnit
          key={`${overlappingDevice.id || overlappingDevice.name}-${unit}-overflow`}
          rack={rack}
          device={overlappingDevice}
          top={top}
          bottom={visibleBottom}
          height={visibleHeight}
          clipped={true}
          onSelect={onSelect}
          onEdit={onEdit}
          unitHeight={unitHeight}
          readonly={readonly}
        />,
      );
      continue;
    }

    rows.push(
      <EmptyUnit
        key={`empty-${unit}`}
        unit={unit}
        unitHeight={unitHeight}
        readonly={readonly}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(rack);
          onEdit?.({ position: unit, u_height: 1, device_type: 'server', name: '' });
        }}
      />,
    );
  }

  return (
    <div className={`overflow-hidden rounded-[20px] border border-white/10 bg-slate-800/90 p-3 shadow-2xl ${className}`}>
      {showHeader ? (
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          {TEXT.rackElevation}
        </div>
      ) : null}
      <div className="space-y-[2px] rounded-[18px] border border-white/10 bg-slate-900/60 p-[6px]">{rows}</div>
    </div>
  );
}
