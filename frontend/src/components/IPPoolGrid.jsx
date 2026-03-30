import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';

const IPPoolGrid = ({ subnetId, ips, onIPClick }) => {
  const gridItems = useMemo(() => {
    const items = [];
    for (let i = 1; i <= 254; i++) {
      const suffix = `.${i}`;
      const ipData = ips.find((ip) => ip.ip_address.endsWith(suffix) && ip.subnet === subnetId);
      items.push({ data: ipData, i });
    }
    return items;
  }, [ips, subnetId]);

  return (
    <div className="grid grid-cols-8 gap-2 p-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16">
      {gridItems.map(({ i, data }) => {
        let bgColor = 'bg-slate-50 border-slate-200 text-slate-400';
        if (data) {
          if (data.is_locked) {
            bgColor = 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm ring-1 ring-blue-200';
          } else if (data.status === 'online' || data.status === 'active') {
            bgColor = 'bg-green-100 border-green-300 text-green-700 font-bold';
          } else if (data.status === 'reserved') {
            bgColor = 'bg-blue-100 border-blue-300 text-blue-700';
          } else if (data.status === 'rogue') {
            bgColor = 'bg-red-100 border-red-300 text-red-700';
          } else {
            bgColor = 'bg-slate-100 border-slate-300 text-slate-500';
          }
        }

        return (
          <div
            key={i}
            onClick={() => onIPClick(data || { ip: `192.168.1.${i}`, status: 'free' })}
            className={`relative flex aspect-square cursor-pointer items-center justify-center rounded border text-xs shadow-sm transition-transform hover:scale-110 ${bgColor}`}
            title={
              data
                ? `${data.ip_address}\n${data.device_name || '未登记设备'}${data.is_locked ? '\n[防误扫锁定]' : ''}`
                : '可用 IP'
            }
          >
            {data?.is_locked ? (
              <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-blue-400 opacity-80" />
            ) : null}
            {i}
          </div>
        );
      })}
    </div>
  );
};

export default IPPoolGrid;
