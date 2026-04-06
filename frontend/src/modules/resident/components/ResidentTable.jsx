import React from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

import { StatusBadge } from '../../../components/common/UI';

function ResidentExpandedDetail({ resident, devices, approvalBadgeStyles }) {
  return (
    <div className="grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[0.95fr_0.95fr_1.5fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">人员联系</div>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <div><span className="font-semibold text-slate-800">姓名：</span>{resident.name}</div>
          <div><span className="font-semibold text-slate-800">岗位：</span>{resident.title || '未填写'}</div>
          <div><span className="font-semibold text-slate-800">电话：</span>{resident.phone || '未填写'}</div>
          <div><span className="font-semibold text-slate-800">邮箱：</span>{resident.email || '未填写'}</div>
          <div><span className="font-semibold text-slate-800">备注：</span>{resident.remarks || '无'}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">办公与审批</div>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <div><span className="font-semibold text-slate-800">公司：</span>{resident.company}</div>
          <div><span className="font-semibold text-slate-800">项目：</span>{resident.project_name || '未关联项目'}</div>
          <div><span className="font-semibold text-slate-800">办公区域：</span>{resident.office_location || '未填写'}</div>
          <div><span className="font-semibold text-slate-800">座位号：</span>{resident.seat_number || '未填写'}</div>
          <div><span className="font-semibold text-slate-800">审批状态：</span>{approvalBadgeStyles[resident.approval_status]?.label || resident.approval_status}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">设备备案详情</div>
          <div className="text-xs text-slate-400">共 {devices.length} 台</div>
        </div>
        <div className="mt-3 space-y-3">
          {devices.length ? (
            devices.map((device, index) => (
              <div key={device.id || `${resident.id}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-900">
                    {device.device_name || device.brand || device.model || `设备 ${index + 1}`}
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {device.brand || '未填品牌'} {device.model || ''}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  <div><span className="font-semibold text-slate-700">序列号：</span>{device.serial_number || '未填写'}</div>
                  <div><span className="font-semibold text-slate-700">有线 MAC：</span>{device.wired_mac || '未填写'}</div>
                  <div><span className="font-semibold text-slate-700">无线 MAC：</span>{device.wireless_mac || '未填写'}</div>
                  <div><span className="font-semibold text-slate-700">备注：</span>{device.remarks || '无'}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
              暂无设备备案信息。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResidentTable({
  filteredResidentStaff,
  expandedResidentIds,
  toggleExpandedResident,
  openEdit,
  exportResident,
  exportResidentPdf,
  reviewResident,
  deleteResident,
  formatDate,
  getDeviceMacSummary,
  getSeatSummary,
  typeLabels,
  approvalBadgeStyles,
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm text-slate-600">
        <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-400">
          <tr>
            <th className="px-6 py-3 font-bold">登记编号 / 人员</th>
            <th className="px-6 py-3 font-bold">公司 / 项目</th>
            <th className="px-6 py-3 font-bold">岗位 / 驻场类型</th>
            <th className="px-6 py-3 font-bold">起止时间</th>
            <th className="px-6 py-3 font-bold">设备速览</th>
            <th className="px-6 py-3 font-bold">审批状态</th>
            <th className="px-6 py-3 font-bold">办公安排</th>
            <th className="px-6 py-3 text-right font-bold">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {filteredResidentStaff.map((resident) => {
            const isExpanded = expandedResidentIds.includes(resident.id);
            const devices = resident.devices || [];
            const primaryDevice = devices[0];

            return (
              <React.Fragment key={resident.id}>
                <tr className="align-top transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{resident.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{resident.registration_code}</div>
                    <div className="mt-2 text-[11px] text-slate-500">{resident.phone || '未填写电话'}</div>
                    <div className="text-[11px] text-slate-400">{resident.email || '未填写邮箱'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{resident.company}</div>
                    <div className="text-[11px] text-slate-400">{resident.project_name || '未关联项目'}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{resident.department || '未填写部门'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div className="font-semibold text-slate-700">{resident.title || '未填写岗位'}</div>
                    <span className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {typeLabels[resident.resident_type] || resident.resident_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div>开始：{formatDate(resident.start_date)}</div>
                    <div>结束：{formatDate(resident.end_date)}</div>
                    {resident.days_remaining != null && (
                      <div className="mt-1 text-[11px] text-slate-400">剩余 {resident.days_remaining} 天</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div className="font-semibold text-slate-700">已备案 {resident.device_count || 0} 台</div>
                    {primaryDevice ? (
                      <>
                        <div className="mt-1 truncate text-[11px] text-slate-500">
                          {primaryDevice.device_name || primaryDevice.brand || '未命名设备'}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">{getDeviceMacSummary(primaryDevice)}</div>
                      </>
                    ) : (
                      <div className="mt-1 text-[11px] text-slate-400">暂无设备备案</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={resident.approval_status} styles={approvalBadgeStyles} />
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div>{resident.needs_seat ? '需要安排座位' : '无需座位'}</div>
                    <div className="mt-1">{getSeatSummary(resident)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-3 text-xs font-bold">
                      <button onClick={() => toggleExpandedResident(resident.id)} className="inline-flex items-center text-slate-600 hover:underline" type="button">
                        {isExpanded ? <ChevronUp className="mr-1 inline h-3.5 w-3.5" /> : <ChevronDown className="mr-1 inline h-3.5 w-3.5" />}
                        {isExpanded ? '收起' : '详情'}
                      </button>
                      <button onClick={() => openEdit(resident)} className="text-blue-600 hover:underline" type="button">
                        <Pencil className="mr-1 inline h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button onClick={() => exportResident(resident)} className="text-slate-600 hover:underline" type="button">Excel</button>
                      <button onClick={() => exportResidentPdf(resident)} className="text-slate-600 hover:underline" type="button">PDF</button>
                      {resident.approval_status !== 'approved' && (
                        <button onClick={() => reviewResident(resident, 'approve')} className="text-emerald-600 hover:underline" type="button">通过</button>
                      )}
                      {resident.approval_status !== 'rejected' && (
                        <button onClick={() => reviewResident(resident, 'reject')} className="text-amber-600 hover:underline" type="button">驳回</button>
                      )}
                      <button onClick={() => deleteResident(resident)} className="text-red-500 hover:underline" type="button">删除</button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={8} className="px-6 pb-5 pt-0">
                      <ResidentExpandedDetail resident={resident} devices={devices} approvalBadgeStyles={approvalBadgeStyles} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {filteredResidentStaff.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-400">
                没有匹配的驻场人员，请调整筛选条件后重试。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
