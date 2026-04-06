import React, { useMemo, useRef, useState } from 'react';
import { Modal } from '../../../components/common/UI';
import ImportWizardModal from '../../../components/ImportWizardModal';
import { safeFetch } from '../../../lib/api';
import {
  ResidentDeviceRegistrationSection,
  ResidentFiltersToolbar,
  ResidentIdentitySection,
  ResidentOverview,
  ResidentOfficeApprovalSection,
  ResidentRegistrationCard,
  ResidentTable,
} from '../components';

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

const getSeatSummary = (resident) => {
  if (!resident.needs_seat) return '无需座位';
  const office = resident.office_location || '未填写办公区域';
  const seat = resident.seat_number ? ` · 座位 ${resident.seat_number}` : '';
  return `${office}${seat}`;
};

const getDeviceMacSummary = (device) => {
  const wired = device.wired_mac ? `有线 ${device.wired_mac}` : '';
  const wireless = device.wireless_mac ? `无线 ${device.wireless_mac}` : '';
  return [wired, wireless].filter(Boolean).join(' / ') || '未登记 MAC';
};

export default function ResidentManagementView({ residentStaff, onRefresh, initialFilters, onConsumeInitialFilters }) {
  const fileInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingResident, setEditingResident] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [expandedResidentIds, setExpandedResidentIds] = useState([]);
  const [filters, setFilters] = useState({
    name: '',
    company: '',
    projectName: '',
    phone: '',
    mac: '',
    approvalStatus: '',
    seatStatus: '',
  });

  React.useEffect(() => {
    if (!initialFilters) return;
    setFilters((prev) => ({
      ...prev,
      name: initialFilters.name || '',
      company: initialFilters.company || '',
      projectName: initialFilters.projectName || '',
      phone: initialFilters.phone || '',
      mac: initialFilters.mac || '',
      approvalStatus: initialFilters.approvalStatus || '',
      seatStatus: initialFilters.seatStatus || '',
    }));
    onConsumeInitialFilters?.();
  }, [initialFilters, onConsumeInitialFilters]);

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

  const filteredResidentStaff = useMemo(() => {
    const normalizedName = filters.name.trim().toLowerCase();
    const normalizedCompany = filters.company.trim().toLowerCase();
    const normalizedProjectName = filters.projectName.trim().toLowerCase();
    const normalizedPhone = filters.phone.trim().toLowerCase();
    const normalizedMac = filters.mac.trim().toLowerCase();
    const normalizedApprovalStatus = filters.approvalStatus.trim().toLowerCase();
    const normalizedSeatStatus = filters.seatStatus.trim().toLowerCase();

    return residentStaff.filter((resident) => {
      const devices = resident.devices || [];
      const residentName = String(resident.name || '').toLowerCase();
      const residentCompany = String(resident.company || '').toLowerCase();
      const residentProjectName = String(resident.project_name || '').toLowerCase();
      const residentPhone = String(resident.phone || '').toLowerCase();
      const residentApprovalStatus = String(resident.approval_status || '').toLowerCase();
      const deviceMacText = devices
        .flatMap((device) => [device.wired_mac, device.wireless_mac])
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const seatStatus = resident.needs_seat
        ? resident.seat_number
          ? 'assigned'
          : 'needed'
        : 'not_needed';

      if (normalizedName && !residentName.includes(normalizedName)) return false;
      if (normalizedCompany && !residentCompany.includes(normalizedCompany)) return false;
      if (normalizedProjectName && !residentProjectName.includes(normalizedProjectName)) return false;
      if (normalizedPhone && !residentPhone.includes(normalizedPhone)) return false;
      if (normalizedMac && !deviceMacText.includes(normalizedMac)) return false;
      if (normalizedApprovalStatus && residentApprovalStatus !== normalizedApprovalStatus) return false;
      if (normalizedSeatStatus && seatStatus !== normalizedSeatStatus) return false;
      return true;
    });
  }, [filters, residentStaff]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const residentTypeOptions = useMemo(
    () => Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
    [],
  );

  const toggleExpandedResident = (residentId) => {
    setExpandedResidentIds((prev) =>
      prev.includes(residentId) ? prev.filter((id) => id !== residentId) : [...prev, residentId],
    );
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      company: '',
      projectName: '',
      phone: '',
      mac: '',
      approvalStatus: '',
      seatStatus: '',
    });
  };

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

    setPendingImportFile(file);
    setImportWizardOpen(true);
    event.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;

    setImporting(true);
    setImportWizardOpen(false);
    try {
      const formDataPayload = new FormData();
      formDataPayload.append('file', pendingImportFile);

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
      setPendingImportFile(null);
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
        <ResidentOverview stats={stats} onOpenCreate={openCreate} />

        <ResidentRegistrationCard
          registrationLink={registrationLink}
          importing={importing}
          onCopyRegistrationLink={copyRegistrationLink}
          onDownloadRegistrationQr={downloadRegistrationQr}
          onDownloadTemplate={downloadTemplate}
          onTriggerImport={triggerImport}
          onExportAllResidents={exportAllResidents}
        />

        <ResidentFiltersToolbar
          filters={filters}
          setFilters={setFilters}
          approvalOptions={approvalOptions}
          activeFilterCount={activeFilterCount}
          filteredResidentStaff={filteredResidentStaff}
          residentStaff={residentStaff}
          onClearFilters={clearFilters}
        />

        <ResidentTable
          filteredResidentStaff={filteredResidentStaff}
          expandedResidentIds={expandedResidentIds}
          toggleExpandedResident={toggleExpandedResident}
          openEdit={openEdit}
          exportResident={exportResident}
          exportResidentPdf={exportResidentPdf}
          reviewResident={reviewResident}
          deleteResident={deleteResident}
          formatDate={formatDate}
          getDeviceMacSummary={getDeviceMacSummary}
          getSeatSummary={getSeatSummary}
          typeLabels={typeLabels}
          approvalBadgeStyles={approvalBadgeStyles}
        />
      </div>

      {isModalOpen && (
        <Modal isOpen onClose={closeModal} title={editingResident ? '编辑驻场人员' : '新增驻场人员'} size="xl">
          <div className="space-y-6">
            <ResidentIdentitySection
              formData={formData}
              setFormData={setFormData}
              typeOptions={residentTypeOptions}
            />

            <ResidentOfficeApprovalSection
              formData={formData}
              setFormData={setFormData}
              approvalOptions={approvalOptions}
            />

            <ResidentDeviceRegistrationSection
              devices={formData.devices}
              updateDevice={updateDevice}
              addDevice={addDevice}
              removeDevice={removeDevice}
              remarks={formData.remarks}
              onRemarksChange={(remarks) => setFormData({ ...formData, remarks })}
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

      {importWizardOpen && pendingImportFile ? (
        <ImportWizardModal
          file={pendingImportFile}
          context="resident"
          onClose={() => {
            setImportWizardOpen(false);
            setPendingImportFile(null);
          }}
          onConfirm={handleConfirmImport}
        />
      ) : null}
    </div>
  );
}
