const formatNumber = (value, suffix = '') => `${Number(value || 0).toLocaleString()}${suffix}`;

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const extractRackActualPower = (rack) => {
  const raw = rack?.description || '';
  const match = raw.match(/__PDU_META__:(\{.*\})/m);
  try {
    const meta = match ? JSON.parse(match[1]) : {};
    return safeInt(meta.power ?? rack?.pdu_power ?? rack?.actual_power ?? 0);
  } catch {
    return safeInt(rack?.pdu_power ?? rack?.actual_power ?? 0);
  }
};

const getRowStart = (totalUnits, unit) => totalUnits - unit + 1;

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

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

const buildRackElevationMarkup = (rack, unitHeight) => {
  const totalUnits = Math.max(1, safeInt(rack.height, 42));
  const layoutDevices = buildDeviceLayout(rack.devices, totalUnits);
  const occupiedUnits = new Set();

  layoutDevices.forEach(({ visibleTop, visibleBottom }) => {
    for (let unit = visibleBottom; unit <= visibleTop; unit += 1) {
      occupiedUnits.add(unit);
    }
  });

  const labels = Array.from({ length: totalUnits }, (_, index) => {
    const unit = totalUnits - index;
    const rowStart = getRowStart(totalUnits, unit);
    return `
      <div class="rack-unit-label" style="grid-column:1;grid-row:${rowStart};">${unit}</div>
      <div class="rack-unit-label" style="grid-column:3;grid-row:${rowStart};">${unit}</div>
    `;
  }).join('');

  const emptyCells = Array.from({ length: totalUnits }, (_, index) => {
    const unit = totalUnits - index;
    if (occupiedUnits.has(unit)) return '';
    return `<div class="rack-empty-cell" style="grid-column:2;grid-row:${getRowStart(totalUnits, unit)};"></div>`;
  }).join('');

  const deviceCells = layoutDevices
    .map(({ key, device, top, bottom, visibleHeight, clipped, rowStart }) => {
      const title = escapeHtml(device.name || '未命名设备');

      return `
        <div
          class="rack-device-cell ${clipped ? 'rack-device-cell-clipped' : ''}"
          style="grid-column:2;grid-row:${rowStart} / span ${visibleHeight};"
          title="${escapeHtml(`${device.name || '未命名设备'} / U位 ${top === bottom ? top : `${Math.max(1, bottom)}-${top}`}`)}"
          data-device-key="${escapeHtml(key)}"
        >
          <div class="rack-device-name">${title}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div
      class="rack-grid"
      style="grid-template-columns:34px minmax(0,1fr) 34px;grid-template-rows:repeat(${totalUnits}, ${unitHeight}px);"
    >
      ${labels}
      ${emptyCells}
      ${deviceCells}
    </div>
  `;
};

const buildRackCardMarkup = (rack, unitHeight) => `
  <section class="rack-card">
    <div class="rack-card-header">
      <div>
        <div class="rack-code-pill">${escapeHtml(rack.code)}</div>
        <div class="rack-title">${escapeHtml(rack.name)}</div>
        <div class="rack-meta">${rack.height}U · ${rack.deviceCount} 台设备 · 空闲 ${rack.freeUnits}U</div>
      </div>
      <div class="rack-util-pill">${rack.utilization}%</div>
    </div>

    <div class="rack-stats">
      <div class="rack-stat">
        <div class="rack-stat-label">规划功率</div>
        <div class="rack-stat-value">${formatNumber(rack.ratedPower, 'W')}</div>
      </div>
      <div class="rack-stat rack-stat-blue">
        <div class="rack-stat-label">实际功率</div>
        <div class="rack-stat-value">${formatNumber(rack.actualPower, 'W')}</div>
      </div>
      <div class="rack-stat rack-stat-emerald">
        <div class="rack-stat-label">典型功率</div>
        <div class="rack-stat-value">${formatNumber(rack.typicalPower, 'W')}</div>
      </div>
    </div>

    <div class="rack-shell">
      ${buildRackElevationMarkup(rack, unitHeight)}
    </div>
  </section>
`;

const buildExportStyles = (columns) => `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    background: #f4f7fb;
    color: #0f172a;
  }
  .export-root {
    width: 100%;
    padding: 28px;
    background: #f4f7fb;
  }
  .hero {
    background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #ecfeff 100%);
    border: 1px solid #dbeafe;
    border-radius: 28px;
    padding: 28px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  }
  .hero-title {
    margin: 0;
    font-size: 34px;
    font-weight: 900;
    line-height: 1.05;
  }
  .hero-subtitle {
    margin-top: 10px;
    color: #475569;
    font-size: 15px;
  }
  .hero-meta {
    margin-top: 14px;
    color: #64748b;
    font-size: 14px;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-top: 18px;
    margin-bottom: 22px;
  }
  .stat-card {
    border: 1px solid #dbe3ef;
    background: #ffffff;
    border-radius: 22px;
    padding: 18px 20px;
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
  }
  .stat-card-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .stat-card-value {
    margin-top: 10px;
    font-size: 28px;
    font-weight: 900;
    color: #0f172a;
  }
  .rack-layout-grid {
    display: grid;
    grid-template-columns: repeat(${columns}, minmax(0, 1fr));
    gap: 18px;
  }
  .rack-card {
    border: 1px solid #d9e2ef;
    background: #ffffff;
    border-radius: 24px;
    padding: 18px;
    box-shadow: 0 16px 30px rgba(15, 23, 42, 0.07);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rack-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .rack-code-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: #eef2ff;
    color: #334155;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
  }
  .rack-title {
    margin-top: 12px;
    font-size: 28px;
    line-height: 1.05;
    font-weight: 900;
    color: #0f172a;
    word-break: break-word;
  }
  .rack-meta {
    margin-top: 8px;
    font-size: 14px;
    color: #64748b;
  }
  .rack-util-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: #ecfdf5;
    color: #047857;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
  }
  .rack-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }
  .rack-stat {
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: #f8fafc;
    padding: 12px;
  }
  .rack-stat-blue {
    background: #eff6ff;
    border-color: #bfdbfe;
  }
  .rack-stat-emerald {
    background: #ecfdf5;
    border-color: #bbf7d0;
  }
  .rack-stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .rack-stat-value {
    margin-top: 8px;
    color: #0f172a;
    font-size: 18px;
    font-weight: 900;
  }
  .rack-shell {
    margin-top: 16px;
    border: 1px solid #cbd5e1;
    border-radius: 18px;
    background: #ffffff;
    padding: 10px;
  }
  .rack-grid {
    display: grid;
    overflow: hidden;
    border: 1px solid #0f172a;
    border-radius: 12px;
    background: #ffffff;
  }
  .rack-unit-label {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #0f172a;
    background: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
  }
  .rack-empty-cell {
    border: 1px solid #cbd5e1;
    background: #ffffff;
  }
  .rack-device-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid #0f172a;
    background: linear-gradient(180deg, #4f79cc 0%, #3b6fd7 100%);
    color: #ffffff;
    text-align: center;
    padding: 4px 6px;
  }
  .rack-device-cell-clipped {
    background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  }
  .rack-device-name {
    font-size: 12px;
    line-height: 1.35;
    font-weight: 800;
    word-break: break-word;
    text-align: center;
  }
`;

const buildExportDocument = (snapshot, options = {}) => {
  const { forImage = false } = options;
  const columnCount = snapshot.rackCount >= 4 ? 4 : snapshot.rackCount >= 2 ? 2 : 1;
  const unitHeight = forImage ? 12 : 14;
  const cardWidth = forImage ? 250 : 270;
  const gap = 18;
  const pagePadding = 28;
  const pageWidth = Math.max(960, pagePadding * 2 + columnCount * cardWidth + (columnCount - 1) * gap);

  const rowHeights = chunk(snapshot.racks, columnCount).map((row) =>
    row.reduce((max, rack) => Math.max(max, 190 + Math.max(1, safeInt(rack.height, 42)) * unitHeight), 0),
  );
  const racksHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rowHeights.length - 1) * gap;
  const totalHeight = Math.max(720, 250 + 150 + racksHeight + 60);

  const markup = `
    <style>${buildExportStyles(columnCount)}</style>
    <div class="export-root" style="width:${pageWidth}px;">
      <section class="hero">
        <h1 class="hero-title">${escapeHtml(snapshot.datacenterName)}</h1>
        <div class="hero-subtitle">${escapeHtml(snapshot.datacenterLocation)}</div>
        <div class="hero-meta">导出时间：${escapeHtml(snapshot.exportedAt)} · 机柜 ${snapshot.rackCount} 台</div>
      </section>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-label">机柜数量</div>
          <div class="stat-card-value">${snapshot.rackCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">规划功率</div>
          <div class="stat-card-value">${formatNumber(snapshot.totalRated, 'W')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">典型功率</div>
          <div class="stat-card-value">${formatNumber(snapshot.totalTypical, 'W')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">PDU 实测</div>
          <div class="stat-card-value">${formatNumber(snapshot.totalPdu, 'W')}</div>
        </div>
      </section>

      <section class="rack-layout-grid">
        ${snapshot.racks.map((rack) => buildRackCardMarkup(rack, unitHeight)).join('')}
      </section>
    </div>
  `;

  return {
    markup,
    pageWidth,
    totalHeight,
  };
};

const buildStandaloneSvg = (markup, pageWidth, totalHeight) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${totalHeight}" viewBox="0 0 ${pageWidth} ${totalHeight}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">${markup}</div>
  </foreignObject>
</svg>`;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const loadSvgImage = (svgMarkup) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('浏览器不支持当前图片渲染方式。'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });

export function buildDcimExportPayload({
  datacenters = [],
  activeLocation,
  racks = [],
  rackDevices = [],
  datacenterPowerStats = {},
  getRackCalculatedPower,
}) {
  const activeDatacenter = datacenters.find((item) => String(item.id) === String(activeLocation));

  const normalizedRacks = racks.map((rack) => {
    const devices = rackDevices
      .filter((device) => String(device.rack) === String(rack.id))
      .sort((a, b) => safeInt(b.position, 0) - safeInt(a.position, 0));
    const height = Math.max(1, safeInt(rack.height, 42));
    const occupied = devices.reduce((sum, device) => sum + Math.max(1, safeInt(device.u_height, 1)), 0);
    const freeUnits = Math.max(0, height - occupied);
    const utilization = height > 0 ? Math.min(100, Math.round((occupied / height) * 100)) : 0;
    const calculated = getRackCalculatedPower ? getRackCalculatedPower(rack.id) : { rated_sum: 0, typical_sum: 0 };

    return {
      id: rack.id,
      code: rack.code || '未编号',
      name: rack.name || rack.code || '未命名机柜',
      height,
      deviceCount: devices.length,
      freeUnits,
      utilization,
      ratedPower: safeInt(calculated.rated_sum, 0),
      typicalPower: safeInt(calculated.typical_sum, 0),
      actualPower: extractRackActualPower(rack),
      devices,
    };
  });

  return {
    exportedAt: new Date().toLocaleString(),
    datacenterName: activeDatacenter?.name || '未选择机房',
    datacenterLocation: activeDatacenter?.location || '未记录位置',
    rackCount: normalizedRacks.length,
    totalRated: safeInt(datacenterPowerStats.total_rated, 0),
    totalTypical: safeInt(datacenterPowerStats.total_typical, 0),
    totalPdu: safeInt(datacenterPowerStats.total_pdu, 0),
    racks: normalizedRacks,
  };
}

export function exportDcimHtmlReport(snapshot) {
  const { markup } = buildExportDocument(snapshot, { forImage: false });
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(snapshot.datacenterName)} - 机柜立面导出</title>
</head>
<body>${markup}</body>
</html>`;

  const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1480,height=980');
  if (!reportWindow) {
    throw new Error('浏览器阻止了导出窗口，请允许弹窗后重试。');
  }
  reportWindow.document.write(html);
  reportWindow.document.close();
}

export async function exportDcimImageReport(snapshot) {
  const { markup, pageWidth, totalHeight } = buildExportDocument(snapshot, { forImage: true });
  const svgMarkup = buildStandaloneSvg(markup, pageWidth, totalHeight);

  try {
    const image = await loadSvgImage(svgMarkup);
    const canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('当前浏览器不支持图片导出。');
    }

    ctx.fillStyle = '#f4f7fb';
    ctx.fillRect(0, 0, pageWidth, totalHeight);
    ctx.drawImage(image, 0, 0, pageWidth, totalHeight);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${snapshot.datacenterName || 'dcim'}_机柜立面.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { format: 'png' };
  } catch (error) {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(svgBlob, `${snapshot.datacenterName || 'dcim'}_机柜立面.svg`);
    return { format: 'svg', fallbackReason: error.message };
  }
}
