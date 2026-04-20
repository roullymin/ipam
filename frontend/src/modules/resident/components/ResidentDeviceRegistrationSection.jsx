import React from 'react';
import { Plus } from 'lucide-react';
import { FormInput } from '../../../components/common/UI';
import { ResidentToggleField } from './ResidentFormFields';

export default function ResidentDeviceRegistrationSection({
  devices,
  updateDevice,
  updateDeviceMac,
  addDevice,
  removeDevice,
  remarks,
  onRemarksChange,
}) {
  return (
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
        {devices.map((device, index) => (
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
                onChange={(event) => updateDeviceMac(index, 'wired_mac', event.target.value)}
                placeholder="782b-4645-c9a0"
              />
              <FormInput
                label="无线 MAC"
                value={device.wireless_mac}
                onChange={(event) => updateDeviceMac(index, 'wireless_mac', event.target.value)}
                placeholder="782b-4645-c9a0"
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
              <ResidentToggleField
                label="已装安全软件"
                checked={!!device.security_software_installed}
                onChange={(checked) => updateDevice(index, { security_software_installed: checked })}
              />
              <ResidentToggleField
                label="正版激活"
                checked={!!device.os_activated}
                onChange={(checked) => updateDevice(index, { os_activated: checked })}
              />
              <ResidentToggleField
                label="已修补漏洞"
                checked={!!device.vulnerabilities_patched}
                onChange={(checked) => updateDevice(index, { vulnerabilities_patched: checked })}
              />
              <ResidentToggleField
                label="发现病毒木马"
                checked={!!device.malware_found}
                onChange={(checked) => updateDevice(index, { malware_found: checked })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <FormInput label="备注" value={remarks} onChange={(event) => onRemarksChange(event.target.value)} />
      </div>
    </section>
  );
}
