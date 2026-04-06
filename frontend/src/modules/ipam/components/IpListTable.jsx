import React from 'react';
import { ArrowLeftRight, Edit2, Tag, Trash2 } from 'lucide-react';

import { StatusBadge } from '../../../components/common/UI';

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return Object.values(value);
  return [];
};

export default function IpListTable({ ips, optionLists, onEdit, onDelete }) {
  const deviceTypes = safeArray(optionLists?.deviceTypes);

  const resolveDeviceType = (value) => {
    const matched = deviceTypes.find((item) => (typeof item === 'object' ? item.value === value : item === value));
    if (!matched) return value || '-';
    return typeof matched === 'object' ? matched.label : matched;
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="custom-scrollbar overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">IP 地址</th>
              <th className="px-5 py-3 font-semibold">状态</th>
              <th className="px-5 py-3 font-semibold">设备名称</th>
              <th className="px-5 py-3 font-semibold">设备类型</th>
              <th className="px-5 py-3 font-semibold">负责人</th>
              <th className="px-5 py-3 font-semibold">NAT</th>
              <th className="px-5 py-3 font-semibold">标签</th>
              <th className="px-5 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ips.map((ip) => (
              <tr key={ip.id} className="group hover:bg-blue-50/40">
                <td className="px-5 py-4 font-mono font-bold text-slate-900">{ip.ip_address}</td>
                <td className="px-5 py-4"><StatusBadge status={ip.status} isLocked={ip.is_locked} /></td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-900">{ip.device_name || '未登记设备'}</div>
                  <div className="mt-1 max-w-[260px] truncate text-xs text-slate-400">{ip.description || '暂无说明'}</div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">{resolveDeviceType(ip.device_type)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{ip.owner || '-'}</td>
                <td className="px-5 py-4">
                  {ip.nat_type && ip.nat_type !== 'none' ? (
                    <div className="inline-flex items-center rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-700" title={`映射到 ${ip.nat_ip || '-'}:${ip.nat_port || '-'}`}>
                      <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                      {ip.nat_ip || '已配置'}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">未配置</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {ip.tag ? (
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      <Tag className="mr-1.5 h-3.5 w-3.5" />
                      {ip.tag}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">无标签</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => onEdit(ip)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" type="button" title="编辑地址">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDelete(ip.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" type="button" title="删除地址">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
