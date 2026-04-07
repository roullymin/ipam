import React from 'react';

const TEXT = {
  overflow: '越界',
  unnamed: '未命名设备',
  managementIp: '管理地址',
  rackElevation: '机柜排位',
  addDevice: '新增',
};

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const getRowStart = (totalUnits, unit) => totalUnits - unit + 1;

const buildDeviceLayout = (devices, totalUnits) =>
  (Array.isArray(devices) ? devices : [])
    .map((device, index) => {
      const top = safeInt(device.position, 0);
      const height = Math.max(1, safeInt(device.u_height, 1));
      const bottom = top - height + 1;
      const visibleTop = Math.min(totalUnits, top);
      const visibleBottom = Math.max(1, bottom);
      const visibleHeight = visibleTop - visibleBottom + 1;

      if (visibleTop < 1 || visibleBottom > totalUnits || visibleHeight <= 0) {
        return null;
      }

      return {
        key: device.id || `${device.name || 'device'}-${index}`,
        device,
        top,
        bottom,
        visibleTop,
        visibleBottom,
        visibleHeight,
        clipped: top > totalUnits || bottom < 1,
        rowStart: getRowStart(totalUnits, visibleTop),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.visibleTop - a.visibleTop || a.visibleBottom - b.visibleBottom);

function RackUnitLabel({ unit, side, totalUnits }) {
  return (
    <div
      className="flex items-center justify-center border border-slate-800 bg-slate-100 text-[10px] font-medium text-slate-700"
      style={{
        gridColumn: side,
        gridRow: getRowStart(totalUnits, unit),
      }}
    >
      {unit}
    </div>
  );
}

function EmptyUnitCell({ rack, unit, readonly, onSelect, onEdit, totalUnits }) {
  if (readonly) {
    return (
      <div
        className="border border-slate-300 bg-white"
        style={{
          gridColumn: 2,
          gridRow: getRowStart(totalUnits, unit),
        }}
      />
    );
  }

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(rack);
        onEdit?.({ position: unit, u_height: 1, device_type: 'server', name: '' });
      }}
      type="button"
      className="group border border-slate-300 bg-white transition-colors hover:bg-sky-50"
      style={{
        gridColumn: 2,
        gridRow: getRowStart(totalUnits, unit),
      }}
      title={`U${unit} ${TEXT.addDevice}`}
    >
      <span className="opacity-0 text-[9px] font-semibold text-sky-600 transition-opacity group-hover:opacity-100">
        {TEXT.addDevice}
      </span>
    </button>
  );
}

function DeviceCell({ rack, layout, onSelect, onEdit, readonly }) {
  const { device, top, bottom, visibleHeight, clipped, rowStart } = layout;
  const cellClass = clipped ? 'bg-[#3b82f6]' : 'bg-[#4f79cc]';
  const textSizeClass =
    visibleHeight >= 8
      ? 'text-[13px] leading-5'
      : visibleHeight >= 4
        ? 'text-[12px] leading-5'
        : visibleHeight >= 2
          ? 'text-[11px] leading-4'
          : 'text-[10px] leading-tight';

  const title = `${device.name || TEXT.unnamed}\nU位: ${
    top === bottom ? top : `${Math.max(1, bottom)}-${top}`
  }\n${TEXT.managementIp}: ${device.mgmt_ip || '-'}`;

  const sharedProps = {
    title,
    className: `relative flex h-full w-full flex-col items-center justify-center overflow-hidden border border-slate-800 px-1.5 text-center text-white shadow-sm ${cellClass}`,
    style: {
      gridColumn: 2,
      gridRow: `${rowStart} / span ${visibleHeight}`,
    },
  };

  const content = (
    <>
      <div
        className={`max-w-full font-bold ${textSizeClass} ${
          visibleHeight <= 2 ? 'line-clamp-2' : visibleHeight <= 4 ? 'line-clamp-3' : 'line-clamp-4'
        }`}
      >
        {device.name || TEXT.unnamed}
      </div>
    </>
  );

  if (readonly) {
    return (
      <div
        title={title}
        className={sharedProps.className}
        style={sharedProps.style}
      >
        {content}
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
      className={`${sharedProps.className} transition-colors hover:bg-[#4068b8]`}
      style={sharedProps.style}
    >
      {content}
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
  const totalUnits = Math.max(1, safeInt(rack.height, 42));
  const layoutDevices = React.useMemo(() => buildDeviceLayout(devices, totalUnits), [devices, totalUnits]);
  const occupiedUnits = React.useMemo(() => {
    const next = new Set();
    layoutDevices.forEach(({ visibleTop, visibleBottom }) => {
      for (let unit = visibleBottom; unit <= visibleTop; unit += 1) {
        next.add(unit);
      }
    });
    return next;
  }, [layoutDevices]);

  const gridTemplateRows = `repeat(${totalUnits}, ${unitHeight}px)`;

  return (
    <div
      className={`overflow-hidden rounded-[18px] border border-slate-300 bg-white p-2 shadow-sm ${className}`}
    >
      {showHeader ? (
        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {TEXT.rackElevation}
        </div>
      ) : null}

      <div
        className="grid overflow-hidden rounded-[10px] border border-slate-800 bg-white"
        style={{
          gridTemplateColumns: '34px minmax(0, 1fr) 34px',
          gridTemplateRows,
        }}
      >
        {Array.from({ length: totalUnits }, (_, index) => {
          const unit = totalUnits - index;
          return (
            <React.Fragment key={`label-${unit}`}>
              <RackUnitLabel unit={unit} side={1} totalUnits={totalUnits} />
              <RackUnitLabel unit={unit} side={3} totalUnits={totalUnits} />
            </React.Fragment>
          );
        })}

        {Array.from({ length: totalUnits }, (_, index) => {
          const unit = totalUnits - index;
          if (occupiedUnits.has(unit)) return null;
          return (
            <EmptyUnitCell
              key={`empty-${unit}`}
              rack={rack}
              unit={unit}
              readonly={readonly}
              onSelect={onSelect}
              onEdit={onEdit}
              totalUnits={totalUnits}
            />
          );
        })}

        {layoutDevices.map((layout) => (
          <DeviceCell
            key={layout.key}
            rack={rack}
            layout={layout}
            onSelect={onSelect}
            onEdit={onEdit}
            readonly={readonly}
          />
        ))}
      </div>
    </div>
  );
}
