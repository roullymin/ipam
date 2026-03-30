import React, { useState } from 'react';
import { ChevronDown, FolderKanban, MapPin, Save, Shield, Tag, Trash2, Zap } from 'lucide-react';
import { FormInput, Modal, SmartInput } from './common/UI';

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-black text-slate-900">{title}</div>
        {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
      </div>
    </div>
  );
}

function FormSection({ icon, title, description, children }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5">
      <SectionTitle icon={icon} title={title} description={description} />
      {children}
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder = '' }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function FooterActions({ onClose, onSubmit, submitLabel, dangerLabel, onDanger }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <div>
        {onDanger ? (
          <button
            onClick={onDanger}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {dangerLabel}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          type="button"
        >
          取消
        </button>
        <button
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
          type="button"
        >
          <Save className="h-4 w-4" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export function RackModal({ rack, onClose, onSave, locations, initialDatacenter }) {
  const [formData, setFormData] = useState({
    ...rack,
    name: rack?.name || '',
    code: rack?.code || '',
    height: safeInt(rack?.height, 42),
    datacenter: rack?.datacenter || initialDatacenter || '',
    description: rack?.description || '',
    pdu_power: safeInt(rack?.pdu_power, 0),
    pdu_count: safeInt(rack?.pdu_count, 2),
    power_limit: safeInt(rack?.power_limit, 0),
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      alert('机柜名称和编号不能为空。');
      return;
    }
    onSave(formData);
  };

  return (
    <Modal isOpen onClose={onClose} title={rack ? '编辑机柜' : '新增机柜'} size="lg">
      <div className="space-y-5">
        <FormSection icon={MapPin} title="基础信息" description="填写机柜名称、编号、所属机房和基础规格。">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label="机柜名称"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="例如：业务机柜 A01"
            />
            <FormInput
              label="机柜编号"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              placeholder="A01"
            />
            <FormInput
              label="机柜高度（U）"
              type="number"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: safeInt(e.target.value, 42) })}
              required
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">所属机房</label>
              <div className="relative">
                <select
                  value={formData.datacenter}
                  onChange={(e) => setFormData({ ...formData, datacenter: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">选择机房...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Zap} title="电力信息" description="记录 PDU 组数、实测功率和设计负载上限。">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormInput
              label="PDU 数量（组）"
              type="number"
              min="1"
              value={formData.pdu_count}
              onChange={(e) => setFormData({ ...formData, pdu_count: safeInt(e.target.value, 2) })}
            />
            <FormInput
              label="PDU 实测总功率（W）"
              type="number"
              min="0"
              value={formData.pdu_power}
              onChange={(e) => setFormData({ ...formData, pdu_power: safeInt(e.target.value, 0) })}
            />
            <FormInput
              label="设计功率上限（W）"
              type="number"
              min="0"
              value={formData.power_limit}
              onChange={(e) => setFormData({ ...formData, power_limit: safeInt(e.target.value, 0) })}
            />
          </div>
        </FormSection>

        <FormSection icon={Tag} title="备注信息" description="可记录业务用途、供电说明、维护窗口等补充内容。">
          <TextareaField
            label="备注"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="例如：核心业务承载机柜，双路供电，每周三维护窗口。"
          />
        </FormSection>

        <FooterActions onClose={onClose} onSubmit={handleSubmit} submitLabel="保存机柜" />
      </div>
    </Modal>
  );
}

export function DatacenterModal({ dc, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: dc?.name || '',
    location: dc?.location || '',
    description: dc?.description || '',
    ...dc,
  });

  return (
    <Modal isOpen onClose={onClose} title={dc ? '编辑机房区域' : '新增机房区域'}>
      <div className="space-y-5">
        <FormSection icon={MapPin} title="机房信息" description="用于展示在机房列表和概览页中的基础信息。">
          <div className="grid grid-cols-1 gap-4">
            <FormInput
              label="机房名称"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="例如：7F 核心机房"
            />
            <FormInput
              label="位置 / 楼层说明"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="例如：708 室 / 7 楼弱电区"
            />
            <TextareaField
              label="备注"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="可填写机房用途、维护说明或容量备注。"
            />
          </div>
        </FormSection>

        <FooterActions onClose={onClose} onSubmit={() => onSave(formData)} submitLabel="保存机房" />
      </div>
    </Modal>
  );
}

export function DeviceModal({
  device,
  onClose,
  onSave,
  onDelete,
  optionLists,
  openOptionManager,
  historyOptions,
  deviceStatus,
}) {
  const DEFAULT_DEVICE_DATA = {
    name: '',
    position: 1,
    u_height: 1,
    device_type: 'server',
    brand: '',
    model: '',
    mgmt_ip: '',
    sn: '',
    asset_tag: '',
    status: 'active',
    purchase_date: '',
    warranty_date: '',
    supplier: '',
    project: '',
    contact: '',
    power_usage: 0,
    typical_power: 0,
    os_version: '',
    specs: '',
  };

  const [formData, setFormData] = useState({ ...DEFAULT_DEVICE_DATA, ...device });
  const isNew = !device.id;

  const handleSubmit = () => {
    if (!formData.name || !formData.device_type) {
      alert('设备名称和设备类型不能为空。');
      return;
    }
    onSave({
      ...formData,
      position: safeInt(formData.position, 1),
      u_height: safeInt(formData.u_height, 1),
      power_usage: safeInt(formData.power_usage, 0),
      typical_power: safeInt(formData.typical_power, 0),
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={isNew ? '上架新设备' : '编辑设备详情'} size="xl">
      <div className="space-y-5">
        <FormSection icon={MapPin} title="位置与基础信息" description="确定设备在机柜中的 U 位、类型和基础标识。">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-2">
              <FormInput
                label="起始 U 位"
                type="number"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <FormInput
                label="高度（U）"
                type="number"
                min="1"
                max="42"
                value={formData.u_height}
                onChange={(e) => setFormData({ ...formData, u_height: e.target.value })}
              />
            </div>
            <div className="md:col-span-4">
              <SmartInput
                label="设备类型"
                listId="dtype-list"
                options={optionLists.deviceTypes}
                value={formData.device_type || ''}
                onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                onManage={() => openOptionManager('deviceTypes')}
                required
              />
            </div>
            <div className="md:col-span-4">
              <FormInput
                label="设备名称"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Core-SW-01"
              />
            </div>
            <div className="md:col-span-6">
              <FormInput
                label="管理 IP（OOB）"
                value={formData.mgmt_ip || ''}
                onChange={(e) => setFormData({ ...formData, mgmt_ip: e.target.value })}
                placeholder="192.168.x.x"
              />
            </div>
            <div className="md:col-span-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">设备状态</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {Object.keys(deviceStatus).map((key) => (
                    <option key={key} value={key}>
                      {deviceStatus[key].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Zap} title="功率与运维信息" description="用于机柜负载统计和日常运维识别。">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SmartInput
              label="额定功率（W）"
              listId="hist-power-rated"
              options={historyOptions.power_usage}
              value={formData.power_usage}
              onChange={(e) => setFormData({ ...formData, power_usage: e.target.value })}
              placeholder="0"
            />
            <SmartInput
              label="典型功率（W）"
              listId="hist-power-typical"
              options={historyOptions.typical_power}
              value={formData.typical_power}
              onChange={(e) => setFormData({ ...formData, typical_power: e.target.value })}
              placeholder="0"
            />
            <SmartInput
              label="负责人"
              listId="hist-contacts"
              options={historyOptions.contacts}
              value={formData.contact || ''}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="可输入姓名、部门或外包负责人"
            />
            <SmartInput
              label="所属项目"
              listId="hist-projects"
              options={historyOptions.projects}
              value={formData.project || ''}
              onChange={(e) => setFormData({ ...formData, project: e.target.value })}
              placeholder="可复用历史项目名称"
            />
            <SmartInput
              label="OS / 固件版本"
              listId="hist-os"
              options={historyOptions.os_versions || []}
              value={formData.os_version || ''}
              onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
              placeholder="例如：Ubuntu 22.04 / V1.3.0"
            />
            <SmartInput
              label="硬件配置摘要"
              listId="hist-specs"
              options={historyOptions.specs}
              value={formData.specs || ''}
              onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
              placeholder="CPU / RAM / Disk ..."
            />
          </div>
        </FormSection>

        <FormSection icon={Shield} title="资产与维保信息" description="用于资产盘点、采购记录和维保跟踪。">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SmartInput
              label="品牌 / 厂商"
              listId="hist-brands"
              options={historyOptions.brands || []}
              value={formData.brand || ''}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
            <SmartInput
              label="具体型号"
              listId="hist-models"
              options={historyOptions.models || []}
              value={formData.model || ''}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
            <SmartInput
              label="供应商"
              listId="hist-suppliers"
              options={historyOptions.suppliers || []}
              value={formData.supplier || ''}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            />
            <FormInput
              label="序列号（S/N）"
              value={formData.sn || ''}
              onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
            />
            <FormInput
              label="固定资产编号"
              value={formData.asset_tag || ''}
              onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
            />
            <SmartInput
              label="采购日期"
              type="date"
              listId="hist-purchase-date"
              options={historyOptions.purchase_date}
              value={formData.purchase_date || ''}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
            />
            <SmartInput
              label="维保到期"
              type="date"
              listId="hist-warranty-date"
              options={historyOptions.warranty_date}
              value={formData.warranty_date || ''}
              onChange={(e) => setFormData({ ...formData, warranty_date: e.target.value })}
            />
          </div>
        </FormSection>

        <FooterActions
          onClose={onClose}
          onSubmit={handleSubmit}
          submitLabel="保存设备"
          dangerLabel={isNew ? undefined : '下架设备'}
          onDanger={isNew ? undefined : () => onDelete(formData.id)}
        />
      </div>
    </Modal>
  );
}
