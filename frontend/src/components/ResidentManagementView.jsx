import React, { useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Copy,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  QrCode,
  Upload,
} from 'lucide-react';
import { FormInput, Modal, StatusBadge } from './common/UI';
import { safeFetch } from '../lib/api';

const EMPTY_DEVICE = {
  device_name: '',
  serial_number: '',
  brand: '',
  model: '',
  wired_mac: '',
  wireless_mac: '',
  security_software_installed: false,
  os_activated: false,
  vulnerabilities_patched: false,
  last_antivirus_at: '',
  malware_found: false,
  malware_notes: '',
  remarks: '',
};

const EMPTY_FORM = {
  company: '',
  name: '',
  title: '',
  phone: '',
  email: '',
  resident_type: 'implementation',
  project_name: '',
  department: '',
  needs_seat: false,
  office_location: '',
  seat_number: '',
  start_date: '',
  end_date: '',
  approval_status: 'pending',
  remarks: '',
  devices: [{ ...EMPTY_DEVICE }],
};

const typeLabels = {
  implementation: '实施驻场',
  operations: '运维值守',
  vendor: '厂商支持',
  visitor: '临时来访',
};

const approvalOptions = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'left', label: '已离场' },
];

const approvalBadgeStyles = {
  pending: {
    label: '待审核',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  approved: {
    label: '已通过',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: '已驳回',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  left: {
    label: '已离场',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('zh-CN');
  } catch {
    return value;
  }
};

const getErrorText = async (response, fallback) => {
  const payload = await response.json().catch(() => ({}));
  if (payload.detail) return payload.detail;
  if (payload.message) return payload.message;
  if (payload.errors) return JSON.stringify(payload.errors);
  return fallback;
};

function SummaryCard({ title, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className={`mt-3 text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

export default function ResidentManagementView({ residentStaff, onRefresh }) {
  const fileInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingResident, setEditingResident] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const registrationLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?resident-intake=1`
      : '?resident-intake=1';

  const stats = useMemo(() => {
    const today = new Date();
    const approved = residentStaff.filter((item) => item.approval_status === 'approved');
    const pending = residentStaff.filter((item) => item.approval_status === 'pending');
    const expiringSoon = approved.filter((item) => {
      if (!item.end_date) return false;
      const delta = Math.ceil((new Date(item.end_date) - today) / (1000 * 60 * 60 * 24));
      return delta >= 0 && delta <= 7;
    });
    const needsSeat = residentStaff.filter((item) => item.needs_seat && !item.seat_number);
    return {
      total: residentStaff.length,
      approved: approved.length,
      pending: pending.length,
      expiringSoon: expiringSoon.length,
      needsSeat: needsSeat.length,
    };
  }, [residentStaff]);

  const openCreate = () => {
    setEditingResident(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (resident) => {
    setEditingResident(resident);
    setFormData({
      ...EMPTY_FORM,
      ...resident,
      start_date: resident.start_date || '',
      end_date: resident.end_date || '',
      devices:
        resident.devices && resident.devices.length
          ? resident.devices.map((device) => ({ ...EMPTY_DEVICE, ...device }))
          : [{ ...EMPTY_DEVICE }],
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingResident(null);
    setFormData(EMPTY_FORM);
  };

  const updateDevice = (index, patch) => {
    setFormData((prev) => ({
      ...prev,
      devices: prev.devices.map((device, currentIndex) =>
        currentIndex === index ? { ...device, ...patch } : device,
      ),
    }));
  };

  const addDevice = () => {
    setFormData((prev) => ({ ...prev, devices: [...prev.devices, { ...EMPTY_DEVICE }] }));
  };

  const removeDevice = (index) => {
    setFormData((prev) => ({
      ...prev,
      devices:
        prev.devices.length === 1
          ? [{ ...EMPTY_DEVICE }]
          : prev.devices.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const saveResident = async () => {
    if (!formData.company || !formData.name || !formData.phone) {
      alert('所属公司、姓名和联系电话不能为空。');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        devices: formData.devices.filter(
          (device) =>
            device.device_name ||
            device.serial_number ||
            device.brand ||
            device.model ||
            device.wired_mac ||
            device.wireless_mac,
        ),
      };

      const response = await safeFetch(
        editingResident ? `/api/resident-staff/${editingResident.id}/` : '/api/resident-staff/',
        {
          method: editingResident ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        alert(await getErrorText(response, '驻场人员保存失败。'));
        return;
      }

      closeModal();
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const reviewResident = async (resident, action) => {
    const label = action === 'approve' ? '通过' : '驳回';
    if (!window.confirm(`确定要${label}“${resident.name}”的驻场申请吗？`)) return;

    const response = await safeFetch(`/api/resident-staff/${resident.id}/${action}/`, {
      method: 'POST',
    });
    if (!response.ok) {
      alert(await getErrorText(response, `${label}失败。`));
      return;
    }

    onRefresh();
  };

  const deleteResident = async (resident) => {
    if (!window.confirm(`确定要删除“${resident.name}”的驻场资料吗？`)) return;

    const response = await safeFetch(`/api/resident-staff/${resident.id}/`, { method: 'DELETE' });
    if (!response.ok) {
      alert(await getErrorText(response, '删除失败。'));
      return;
    }

    onRefresh();
  };

  const exportResident = (resident) => {
    window.open(`/api/resident-staff/${resident.id}/export_sheet/`, '_blank');
  };

  const exportResidentPdf = (resident) => {
    window.open(`/api/resident-staff/${resident.id}/export_pdf/`, '_blank');
  };

  const exportAllResidents = () => {
    window.open('/api/resident-staff/export_excel/', '_blank');
  };

  const downloadTemplate = () => {
    window.open('/api/resident-staff/download_template/', '_blank');
  };

  const downloadRegistrationQr = () => {
    window.open('/api/resident-staff/registration_qr/', '_blank');
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formDataPayload = new FormData();
      formDataPayload.append('file', file);

      const response = await safeFetch('/api/resident-staff/import_excel/', {
        method: 'POST',
        body: formDataPayload,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(payload.detail || '批量导入失败。');
        return;
      }

      const errorText =
        payload.errors && payload.errors.length
          ? `\n\n以下记录存在提示：\n${payload.errors.slice(0, 5).join('\n')}`
          : '';
      alert(`${payload.message || '导入完成。'}${errorText}`);
      onRefresh();
    } finally {
      event.target.value = '';
      setImporting(false);
    }
  };

  const copyRegistrationLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationLink);
      alert('登记链接已复制，可直接生成二维码发给驻场人员。');
    } catch {
      alert(`请手动复制这条链接：\n${registrationLink}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-500">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">驻场人员管理</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              统一管理驻场申请、设备备案、审批状态和签批导出，同时为公开扫码登记提供标准化入口。
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            type="button"
          >
            <Plus className="mr-2 h-5 w-5" />
            新增驻场人员
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <SummaryCard title="在册人数" value={stats.total} />
          <SummaryCard title="已通过" value={stats.approved} tone="text-emerald-600" />
          <SummaryCard title="待审核" value={stats.pending} tone="text-amber-600" />
          <SummaryCard title="即将到期" value={stats.expiringSoon} tone="text-rose-600" />
          <SummaryCard title="待安排座位" value={stats.needsSeat} tone="text-cyan-600" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <ClipboardList className="h-4 w-4 text-blue-600" />
                公开登记入口
              </div>
              <div className="text-sm text-slate-500">
                扫码后可直接填写申请，提交后进入待审核，并支持下载当前申请的 PDF 签批单。
              </div>
              <div className="font-mono text-xs text-slate-400">{registrationLink}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyRegistrationLink}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <Copy className="mr-2 inline h-4 w-4" />
                复制链接
              </button>
              <button
                onClick={downloadRegistrationQr}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <QrCode className="mr-2 inline h-4 w-4" />
                下载二维码
              </button>
              <button
                onClick={downloadTemplate}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <FileSpreadsheet className="mr-2 inline h-4 w-4" />
                下载模板
              </button>
              <button
                onClick={triggerImport}
                disabled={importing}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                type="button"
              >
                <Upload className="mr-2 inline h-4 w-4" />
                批量导入
              </button>
              <button
                onClick={exportAllResidents}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <Download className="mr-2 inline h-4 w-4" />
                导出全部
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-6 py-3 font-bold">登记编号 / 人员</th>
                <th className="px-6 py-3 font-bold">公司 / 项目</th>
                <th className="px-6 py-3 font-bold">驻场类型</th>
                <th className="px-6 py-3 font-bold">起止时间</th>
                <th className="px-6 py-3 font-bold">设备备案</th>
                <th className="px-6 py-3 font-bold">审批状态</th>
                <th className="px-6 py-3 font-bold">办公安排</th>
                <th className="px-6 py-3 text-right font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {residentStaff.map((resident) => (
                <tr key={resident.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{resident.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{resident.registration_code}</div>
                    <div className="text-[11px] text-slate-400">{resident.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{resident.company}</div>
                    <div className="text-[11px] text-slate-400">{resident.project_name || '未关联项目'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {typeLabels[resident.resident_type] || resident.resident_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div>开始：{formatDate(resident.start_date)}</div>
                    <div>结束：{formatDate(resident.end_date)}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    已备案 {resident.device_count || 0} 台
                    {resident.days_remaining != null && (
                      <div className="mt-1 text-[11px] text-slate-400">剩余 {resident.days_remaining} 天</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={resident.approval_status} styles={approvalBadgeStyles} />
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div>{resident.needs_seat ? '需要安排座位' : '无需座位'}</div>
                    <div>{resident.office_location || resident.seat_number || '尚未安排'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-3 text-xs font-bold">
                      <button
                        onClick={() => openEdit(resident)}
                        className="text-blue-600 hover:underline"
                        type="button"
                      >
                        <Pencil className="mr-1 inline h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button onClick={() => exportResident(resident)} className="text-slate-600 hover:underline" type="button">
                        Excel
                      </button>
                      <button onClick={() => exportResidentPdf(resident)} className="text-slate-600 hover:underline" type="button">
                        PDF
                      </button>
                      {resident.approval_status !== 'approved' && (
                        <button
                          onClick={() => reviewResident(resident, 'approve')}
                          className="text-emerald-600 hover:underline"
                          type="button"
                        >
                          通过
                        </button>
                      )}
                      {resident.approval_status !== 'rejected' && (
                        <button
                          onClick={() => reviewResident(resident, 'reject')}
                          className="text-amber-600 hover:underline"
                          type="button"
                        >
                          驳回
                        </button>
                      )}
                      <button onClick={() => deleteResident(resident)} className="text-red-500 hover:underline" type="button">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal isOpen onClose={closeModal} title={editingResident ? '编辑驻场人员' : '新增驻场人员'} size="xl">
          <div className="space-y-6">
            <section>
              <h4 className="mb-4 text-sm font-bold text-slate-800">人员信息</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="所属公司"
                  value={formData.company}
                  onChange={(event) => setFormData({ ...formData, company: event.target.value })}
                  required
                />
                <FormInput
                  label="姓名"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  required
                />
                <FormInput
                  label="职务 / 岗位"
                  value={formData.title}
                  onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                />
                <FormInput
                  label="联系电话"
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  required
                />
                <FormInput
                  label="邮箱"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                />
                <SelectField
                  label="驻场类型"
                  value={formData.resident_type}
                  options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))}
                  onChange={(value) => setFormData({ ...formData, resident_type: value })}
                />
                <FormInput
                  label="所属项目"
                  value={formData.project_name}
                  onChange={(event) => setFormData({ ...formData, project_name: event.target.value })}
                />
                <FormInput
                  label="归属部门"
                  value={formData.department}
                  onChange={(event) => setFormData({ ...formData, department: event.target.value })}
                />
              </div>
            </section>

            <section>
              <h4 className="mb-4 text-sm font-bold text-slate-800">办公与审批</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="驻场开始日期"
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(event) => setFormData({ ...formData, start_date: event.target.value })}
                />
                <FormInput
                  label="驻场结束日期"
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(event) => setFormData({ ...formData, end_date: event.target.value })}
                />
                <FormInput
                  label="办公区域"
                  value={formData.office_location}
                  onChange={(event) => setFormData({ ...formData, office_location: event.target.value })}
                />
                <FormInput
                  label="座位号"
                  value={formData.seat_number}
                  onChange={(event) => setFormData({ ...formData, seat_number: event.target.value })}
                />
                <SelectField
                  label="审批状态"
                  value={formData.approval_status}
                  options={approvalOptions}
                  onChange={(value) => setFormData({ ...formData, approval_status: value })}
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!formData.needs_seat}
                  onChange={(event) => setFormData({ ...formData, needs_seat: event.target.checked })}
                />
                需要安排座位
              </label>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">设备备案</h4>
                <button
                  onClick={addDevice}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                  type="button"
                >
                  <Plus className="mr-1 inline h-3.5 w-3.5" />
                  添加设备
                </button>
              </div>
              <div className="space-y-4">
                {formData.devices.map((device, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">设备 {index + 1}</div>
                      <button
                        onClick={() => removeDevice(index)}
                        className="text-xs font-semibold text-red-500 hover:underline"
                        type="button"
                      >
                        删除设备
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormInput
                        label="设备名称"
                        value={device.device_name}
                        onChange={(event) => updateDevice(index, { device_name: event.target.value })}
                      />
                      <FormInput
                        label="序列号"
                        value={device.serial_number}
                        onChange={(event) => updateDevice(index, { serial_number: event.target.value })}
                      />
                      <FormInput
                        label="品牌"
                        value={device.brand}
                        onChange={(event) => updateDevice(index, { brand: event.target.value })}
                      />
                      <FormInput
                        label="型号"
                        value={device.model}
                        onChange={(event) => updateDevice(index, { model: event.target.value })}
                      />
                      <FormInput
                        label="有线 MAC"
                        value={device.wired_mac}
                        onChange={(event) => updateDevice(index, { wired_mac: event.target.value })}
                      />
                      <FormInput
                        label="无线 MAC"
                        value={device.wireless_mac}
                        onChange={(event) => updateDevice(index, { wireless_mac: event.target.value })}
                      />
                      <FormInput
                        label="最近杀毒日期"
                        type="date"
                        value={device.last_antivirus_at || ''}
                        onChange={(event) => updateDevice(index, { last_antivirus_at: event.target.value })}
                      />
                      <FormInput
                        label="病毒木马说明"
                        value={device.malware_notes}
                        onChange={(event) => updateDevice(index, { malware_notes: event.target.value })}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <ToggleField
                        label="已装安全软件"
                        checked={!!device.security_software_installed}
                        onChange={(checked) => updateDevice(index, { security_software_installed: checked })}
                      />
                      <ToggleField
                        label="正版激活"
                        checked={!!device.os_activated}
                        onChange={(checked) => updateDevice(index, { os_activated: checked })}
                      />
                      <ToggleField
                        label="已修补漏洞"
                        checked={!!device.vulnerabilities_patched}
                        onChange={(checked) => updateDevice(index, { vulnerabilities_patched: checked })}
                      />
                      <ToggleField
                        label="发现病毒木马"
                        checked={!!device.malware_found}
                        onChange={(checked) => updateDevice(index, { malware_found: checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <FormInput
              label="备注"
              value={formData.remarks}
              onChange={(event) => setFormData({ ...formData, remarks: event.target.value })}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-slate-500 hover:bg-slate-50"
                type="button"
              >
                取消
              </button>
              <button
                onClick={saveResident}
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                type="button"
              >
                {submitting ? '保存中...' : editingResident ? '保存修改' : '创建驻场记录'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
