import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Download, Plus, Printer, ShieldCheck, Trash2, Users } from 'lucide-react';
import { fetchCsrfToken, safeFetch } from '../../../lib/api';
import { formatResidentMac } from '../utils/mac';

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

const EMPTY_MEMBER = {
  name: '',
  title: '',
  phone: '',
  email: '',
  needs_seat: false,
  office_location: '',
  seat_number: '',
  remarks: '',
  devices: [{ ...EMPTY_DEVICE }],
};

const EMPTY_COMPANY_PROFILE = {
  company: '',
  project_name: '',
  department: '',
  resident_type: 'implementation',
  start_date: '',
  end_date: '',
};

const residentTypeOptions = [
  { value: 'implementation', label: '实施驻场' },
  { value: 'operations', label: '运维值守' },
  { value: 'vendor', label: '厂商支持' },
  { value: 'visitor', label: '临时来访' },
];

const createObjectUrlAndOpen = (blob, { download = false, filename = 'resident_batch.pdf' } = {}) => {
  const objectUrl = window.URL.createObjectURL(blob);
  if (download) {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  const previewWindow = window.open(objectUrl, '_blank');
  if (previewWindow) {
    previewWindow.focus();
  }
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 5000);
};

export default function ResidentIntakePage() {
  const [companyProfile, setCompanyProfile] = useState(EMPTY_COMPANY_PROFILE);
  const [staffMembers, setStaffMembers] = useState([{ ...EMPTY_MEMBER }]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedCodes, setSubmittedCodes] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    fetchCsrfToken();
  }, []);

  const submittedSummary = useMemo(
    () => ({
      count: submittedCodes.length,
      codeText: submittedCodes.join('、'),
    }),
    [submittedCodes],
  );

  const updateMember = (index, patch) => {
    setStaffMembers((prev) =>
      prev.map((member, memberIndex) =>
        memberIndex === index ? { ...member, ...patch } : member,
      ),
    );
  };

  const updateDevice = (memberIndex, deviceIndex, patch) => {
    setStaffMembers((prev) =>
      prev.map((member, currentMemberIndex) =>
        currentMemberIndex === memberIndex
          ? {
              ...member,
              devices: member.devices.map((device, currentDeviceIndex) =>
                currentDeviceIndex === deviceIndex ? { ...device, ...patch } : device,
              ),
            }
          : member,
      ),
    );
  };

  const updateDeviceMac = (memberIndex, deviceIndex, field, value) => {
    updateDevice(memberIndex, deviceIndex, { [field]: formatResidentMac(value) });
  };

  const addMember = () => {
    setStaffMembers((prev) => [...prev, { ...EMPTY_MEMBER }]);
  };

  const removeMember = (index) => {
    setStaffMembers((prev) => (prev.length === 1 ? [{ ...EMPTY_MEMBER }] : prev.filter((_, currentIndex) => currentIndex !== index)));
  };

  const addDevice = (memberIndex) => {
    setStaffMembers((prev) =>
      prev.map((member, currentIndex) =>
        currentIndex === memberIndex
          ? { ...member, devices: [...member.devices, { ...EMPTY_DEVICE }] }
          : member,
      ),
    );
  };

  const removeDevice = (memberIndex, deviceIndex) => {
    setStaffMembers((prev) =>
      prev.map((member, currentIndex) =>
        currentIndex === memberIndex
          ? {
              ...member,
              devices:
                member.devices.length === 1
                  ? [{ ...EMPTY_DEVICE }]
                  : member.devices.filter((_, currentDeviceIndex) => currentDeviceIndex !== deviceIndex),
            }
          : member,
      ),
    );
  };

  const resetForm = () => {
    setCompanyProfile(EMPTY_COMPANY_PROFILE);
    setStaffMembers([{ ...EMPTY_MEMBER }]);
    setSubmittedCodes([]);
  };

  const submit = async () => {
    if (!companyProfile.company) {
      alert('所属公司不能为空。');
      return;
    }

    const normalizedMembers = staffMembers.map((member) => ({
      ...member,
      devices: member.devices.filter(
        (device) =>
          device.device_name ||
          device.serial_number ||
          device.brand ||
          device.model ||
          device.wired_mac ||
          device.wireless_mac,
      ),
    }));

    const invalidMemberIndex = normalizedMembers.findIndex(
      (member) => !member.name || !member.phone,
    );
    if (invalidMemberIndex >= 0) {
      alert(`第 ${invalidMemberIndex + 1} 位人员缺少姓名或联系电话。`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await safeFetch('/api/resident-intake/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_profile: companyProfile,
          staff_members: normalizedMembers,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(JSON.stringify(payload.errors || payload.detail || '提交失败'));
        return;
      }

      setSubmittedCodes(payload.registration_codes || []);
    } finally {
      setSubmitting(false);
    }
  };

  const exportSubmittedPdf = async (mode = 'download') => {
    if (!submittedCodes.length) return;

    setExportingPdf(true);
    try {
      const response = await safeFetch('/api/resident-intake/export-pdf/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_codes: submittedCodes }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        alert(errorText || '导出申请单失败。');
        return;
      }

      const pdfBlob = await response.blob();
      createObjectUrlAndOpen(pdfBlob, {
        download: mode === 'download',
        filename:
          submittedCodes.length > 1
            ? 'resident_batch_application.pdf'
            : `resident_${submittedCodes[0]}.pdf`,
      });
    } finally {
      setExportingPdf(false);
    }
  };

  if (submittedCodes.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-9 w-9 text-emerald-600" />
            <div className="flex-1">
              <div className="text-3xl font-black text-slate-900">登记已提交</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                本次提交的驻场资料已进入待审核列表。你可以现在直接下载或打印申请单，拿给项目经理或领导签字。
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">本次登记编号</div>
            <div className="mt-3 text-lg font-black leading-8 text-slate-900">{submittedSummary.codeText}</div>
            <div className="mt-2 text-xs text-slate-500">共 {submittedSummary.count} 人</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => exportSubmittedPdf('download')}
              disabled={exportingPdf}
              className="flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-300"
              type="button"
            >
              <Download className="mr-2 h-4 w-4" />
              {exportingPdf ? '处理中...' : '下载申请单 PDF'}
            </button>
            <button
              onClick={() => exportSubmittedPdf('print')}
              disabled={exportingPdf}
              className="flex items-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              type="button"
            >
              <Printer className="mr-2 h-4 w-4" />
              打开打印版
            </button>
            <button
              onClick={resetForm}
              className="flex items-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
            >
              继续登记下一批
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">驻场人员登记</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                链接地址固定不变。支持同公司多名人员一次登记，提交后即可下载或打印本次申请单。
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">公司公共信息</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="所属公司"
                value={companyProfile.company}
                onChange={(value) => setCompanyProfile({ ...companyProfile, company: value })}
                required
              />
              <Field
                label="所属项目"
                value={companyProfile.project_name}
                onChange={(value) => setCompanyProfile({ ...companyProfile, project_name: value })}
              />
              <Field
                label="归属部门"
                value={companyProfile.department}
                onChange={(value) => setCompanyProfile({ ...companyProfile, department: value })}
              />
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  驻场类型
                </label>
                <select
                  value={companyProfile.resident_type}
                  onChange={(event) =>
                    setCompanyProfile({ ...companyProfile, resident_type: event.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  {residentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="驻场开始日期"
                type="date"
                value={companyProfile.start_date}
                onChange={(value) => setCompanyProfile({ ...companyProfile, start_date: value })}
              />
              <Field
                label="驻场结束日期"
                type="date"
                value={companyProfile.end_date}
                onChange={(value) => setCompanyProfile({ ...companyProfile, end_date: value })}
              />
            </div>
          </section>

          <section className="mt-10 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">驻场人员列表</h2>
              <button
                onClick={addMember}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                type="button"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                新增人员
              </button>
            </div>

            <div className="space-y-6">
              {staffMembers.map((member, memberIndex) => (
                <div key={memberIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-base font-bold text-slate-900">人员 {memberIndex + 1}</div>
                    <button
                      onClick={() => removeMember(memberIndex)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      type="button"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                      删除人员
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="姓名"
                      value={member.name}
                      onChange={(value) => updateMember(memberIndex, { name: value })}
                      required
                    />
                    <Field
                      label="联系电话"
                      value={member.phone}
                      onChange={(value) => updateMember(memberIndex, { phone: value })}
                      required
                    />
                    <Field
                      label="职务 / 岗位"
                      value={member.title}
                      onChange={(value) => updateMember(memberIndex, { title: value })}
                    />
                    <Field
                      label="邮箱"
                      value={member.email}
                      onChange={(value) => updateMember(memberIndex, { email: value })}
                    />
                    <Field
                      label="办公区域"
                      value={member.office_location}
                      onChange={(value) => updateMember(memberIndex, { office_location: value })}
                    />
                    <Field
                      label="座位号"
                      value={member.seat_number}
                      onChange={(value) => updateMember(memberIndex, { seat_number: value })}
                    />
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!member.needs_seat}
                      onChange={(event) =>
                        updateMember(memberIndex, { needs_seat: event.target.checked })
                      }
                    />
                    需要安排座位
                  </label>

                  <div className="mt-5">
                    <Field
                      label="人员备注"
                      value={member.remarks}
                      onChange={(value) => updateMember(memberIndex, { remarks: value })}
                    />
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-800">设备备案</div>
                      <button
                        onClick={() => addDevice(memberIndex)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                        type="button"
                      >
                        <Plus className="mr-1 inline h-3.5 w-3.5" />
                        添加设备
                      </button>
                    </div>

                    {member.devices.map((device, deviceIndex) => (
                      <div key={deviceIndex} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">
                            设备 {memberIndex + 1}-{deviceIndex + 1}
                          </div>
                          <button
                            onClick={() => removeDevice(memberIndex, deviceIndex)}
                            className="text-xs font-semibold text-red-500 hover:underline"
                            type="button"
                          >
                            删除设备
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Field
                            label="设备名称"
                            value={device.device_name}
                            onChange={(value) => updateDevice(memberIndex, deviceIndex, { device_name: value })}
                          />
                          <Field
                            label="序列号"
                            value={device.serial_number}
                            onChange={(value) =>
                              updateDevice(memberIndex, deviceIndex, { serial_number: value })
                            }
                          />
                          <Field
                            label="品牌"
                            value={device.brand}
                            onChange={(value) => updateDevice(memberIndex, deviceIndex, { brand: value })}
                          />
                          <Field
                            label="型号"
                            value={device.model}
                            onChange={(value) => updateDevice(memberIndex, deviceIndex, { model: value })}
                          />
                          <Field
                            label="有线 MAC"
                            value={device.wired_mac}
                            onChange={(value) => updateDeviceMac(memberIndex, deviceIndex, 'wired_mac', value)}
                            placeholder="782b-4645-c9a0"
                          />
                          <Field
                            label="无线 MAC"
                            value={device.wireless_mac}
                            onChange={(value) => updateDeviceMac(memberIndex, deviceIndex, 'wireless_mac', value)}
                            placeholder="782b-4645-c9a0"
                          />
                          <Field
                            label="最近杀毒日期"
                            type="date"
                            value={device.last_antivirus_at}
                            onChange={(value) =>
                              updateDevice(memberIndex, deviceIndex, { last_antivirus_at: value })
                            }
                          />
                          <Field
                            label="病毒木马说明"
                            value={device.malware_notes}
                            onChange={(value) =>
                              updateDevice(memberIndex, deviceIndex, { malware_notes: value })
                            }
                          />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                          <Toggle
                            label="已装安全软件"
                            checked={!!device.security_software_installed}
                            onChange={(checked) =>
                              updateDevice(memberIndex, deviceIndex, { security_software_installed: checked })
                            }
                          />
                          <Toggle
                            label="正版激活"
                            checked={!!device.os_activated}
                            onChange={(checked) =>
                              updateDevice(memberIndex, deviceIndex, { os_activated: checked })
                            }
                          />
                          <Toggle
                            label="已修补漏洞"
                            checked={!!device.vulnerabilities_patched}
                            onChange={(checked) =>
                              updateDevice(memberIndex, deviceIndex, { vulnerabilities_patched: checked })
                            }
                          />
                          <Toggle
                            label="发现病毒木马"
                            checked={!!device.malware_found}
                            onChange={(checked) =>
                              updateDevice(memberIndex, deviceIndex, { malware_found: checked })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 flex justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-300"
              type="button"
            >
              {submitting ? '提交中...' : `提交本次登记（${staffMembers.length} 人）`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required = false, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
