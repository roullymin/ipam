const formatNumber = (value, suffix = '') => `${Number(value || 0).toLocaleString()}${suffix}`;

export function buildDcimExportPayload({
  datacenters = [],
  activeLocation,
  racks = [],
  datacenterPowerStats = {},
  getRackCalculatedPower,
}) {
  const activeDatacenter = datacenters.find((item) => String(item.id) === String(activeLocation));
  return {
    exportedAt: new Date().toLocaleString(),
    datacenterName: activeDatacenter?.name || '未选择机房',
    datacenterLocation: activeDatacenter?.location || '未记录位置',
    rackCount: racks.length,
    totalRated: datacenterPowerStats.total_rated || 0,
    totalTypical: datacenterPowerStats.total_typical || 0,
    totalPdu: datacenterPowerStats.total_pdu || 0,
    racks: racks.map((rack) => {
      const calculated = getRackCalculatedPower ? getRackCalculatedPower(rack.id) : { rated_sum: 0, typical_sum: 0 };
      return {
        id: rack.id,
        code: rack.code || '未编号',
        name: rack.name || rack.code || '未命名机柜',
        height: rack.height || 42,
        load: rack.load || 0,
        pduPower: rack.pdu_power || 0,
        pduCount: rack.pdu_count || 0,
        ratedPower: calculated.rated_sum || 0,
        typicalPower: calculated.typical_sum || 0,
      };
    }),
  };
}

export function exportDcimHtmlReport(snapshot) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${snapshot.datacenterName} - 机房资产导出</title>
  <style>
    body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .page { max-width: 1120px; margin: 0 auto; }
    .hero { background: linear-gradient(135deg, #eff6ff, #ffffff); border: 1px solid #dbeafe; border-radius: 24px; padding: 28px; margin-bottom: 24px; }
    .hero h1 { margin: 0 0 8px; font-size: 32px; }
    .hero p { margin: 0; color: #64748b; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
    .stat .label { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .stat .value { font-size: 28px; font-weight: 700; }
    .table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
    .table th, .table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 14px; }
    .table th { background: #f8fafc; color: #475569; }
    .load-bar { height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; width: 140px; }
    .load-inner { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #3b82f6, #14b8a6); }
    @media print { body { padding: 0; background: white; } .hero, .stat, .table { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${snapshot.datacenterName}</h1>
      <p>位置：${snapshot.datacenterLocation} · 导出时间：${snapshot.exportedAt}</p>
    </section>
    <section class="stats">
      <div class="stat"><div class="label">机柜数量</div><div class="value">${snapshot.rackCount}</div></div>
      <div class="stat"><div class="label">额定总功率</div><div class="value">${formatNumber(snapshot.totalRated, ' W')}</div></div>
      <div class="stat"><div class="label">典型功率估算</div><div class="value">${formatNumber(snapshot.totalTypical, ' W')}</div></div>
      <div class="stat"><div class="label">PDU 实测功率</div><div class="value">${formatNumber(snapshot.totalPdu, ' W')}</div></div>
    </section>
    <table class="table">
      <thead>
        <tr>
          <th>机柜编号</th>
          <th>机柜名称</th>
          <th>高度</th>
          <th>空间占用</th>
          <th>额定功率</th>
          <th>典型功率</th>
          <th>PDU 实测</th>
        </tr>
      </thead>
      <tbody>
        ${snapshot.racks
          .map(
            (rack) => `
          <tr>
            <td>${rack.code}</td>
            <td>${rack.name}</td>
            <td>${rack.height}U</td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="load-bar"><div class="load-inner" style="width:${Math.max(0, Math.min(rack.load, 100))}%"></div></div>
                <span>${rack.load}%</span>
              </div>
            </td>
            <td>${formatNumber(rack.ratedPower, ' W')}</td>
            <td>${formatNumber(rack.typicalPower, ' W')}</td>
            <td>${formatNumber(rack.pduPower, ' W')}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
  if (!reportWindow) {
    throw new Error('浏览器阻止了导出窗口，请允许弹窗后重试。');
  }
  reportWindow.document.write(html);
  reportWindow.document.close();
}

export function exportDcimImageReport(snapshot) {
  const width = 1600;
  const headerHeight = 220;
  const rowHeight = 64;
  const footerHeight = 80;
  const height = headerHeight + Math.max(snapshot.racks.length, 1) * rowHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持图片导出。');
  }

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#dbeafe');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  roundRect(ctx, 40, 32, width - 80, 160, 28, true);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 44px "Microsoft YaHei"';
  ctx.fillText(snapshot.datacenterName, 72, 100);
  ctx.font = '24px "Microsoft YaHei"';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`位置：${snapshot.datacenterLocation}`, 72, 145);
  ctx.fillText(`导出时间：${snapshot.exportedAt}`, 72, 180);

  const statCards = [
    ['机柜数量', String(snapshot.rackCount)],
    ['额定总功率', formatNumber(snapshot.totalRated, ' W')],
    ['典型功率', formatNumber(snapshot.totalTypical, ' W')],
    ['PDU 实测', formatNumber(snapshot.totalPdu, ' W')],
  ];
  statCards.forEach(([label, value], index) => {
    const x = 40 + index * 385;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, 220, 360, 120, 24, true);
    ctx.fillStyle = '#64748b';
    ctx.font = '20px "Microsoft YaHei"';
    ctx.fillText(label, x + 28, 270);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px "Microsoft YaHei"';
    ctx.fillText(value, x + 28, 318);
  });

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 40, 372, width - 80, height - 412, 28, true);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 22px "Microsoft YaHei"';
  const headers = ['机柜编号', '机柜名称', '空间占用', '额定功率', '典型功率', 'PDU 实测'];
  const columns = [80, 260, 620, 930, 1130, 1320];
  headers.forEach((header, index) => ctx.fillText(header, columns[index], 420));

  snapshot.racks.forEach((rack, index) => {
    const y = 470 + index * rowHeight;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(70, y - 24);
    ctx.lineTo(width - 70, y - 24);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '20px "Microsoft YaHei"';
    ctx.fillText(rack.code, columns[0], y);
    ctx.fillText(rack.name, columns[1], y);

    ctx.fillStyle = '#e2e8f0';
    roundRect(ctx, columns[2], y - 18, 180, 12, 999, true);
    ctx.fillStyle = '#2563eb';
    roundRect(ctx, columns[2], y - 18, Math.max(8, 180 * Math.max(0, Math.min(rack.load, 100)) / 100), 12, 999, true);
    ctx.fillStyle = '#334155';
    ctx.font = '18px "Microsoft YaHei"';
    ctx.fillText(`${rack.load}%`, columns[2] + 196, y);
    ctx.fillText(formatNumber(rack.ratedPower, 'W'), columns[3], y);
    ctx.fillText(formatNumber(rack.typicalPower, 'W'), columns[4], y);
    ctx.fillText(formatNumber(rack.pduPower, 'W'), columns[5], y);
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${snapshot.datacenterName || 'dcim'}_机房概览.png`;
  link.click();
}

function roundRect(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
}
