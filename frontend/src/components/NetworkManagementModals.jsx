import React from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  Lock,
  Network,
  Save,
  Settings,
} from 'lucide-react';
import { FormInput, Modal, SmartInput } from './common/UI';

export default function NetworkManagementModals({
  isSectionModalOpen,
  setIsSectionModalOpen,
  sectionFormData,
  setSectionFormData,
  handleSaveSection,
  isSubnetModalOpen,
  setIsSubnetModalOpen,
  subnetFormData,
  setSubnetFormData,
  optionLists,
  openOptionManager,
  handleSaveSubnet,
  isIPModalOpen,
  setIsIPModalOpen,
  ipFormData,
  setIpFormData,
  historyOptions,
  handleSaveIP,
}) {
  return (
    <>
      {isSectionModalOpen && (
        <Modal
          isOpen={isSectionModalOpen}
          onClose={() => setIsSectionModalOpen(false)}
          title="新建业务区域"
        >
          <div className="space-y-4">
            <FormInput
              label="区域名称"
              value={sectionFormData.name || ''}
              onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
              required
            />
            <FormInput
              label="描述"
              value={sectionFormData.description || ''}
              onChange={(e) =>
                setSectionFormData({ ...sectionFormData, description: e.target.value })
              }
            />
            <button
              onClick={handleSaveSection}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700"
            >
              确认创建
            </button>
          </div>
        </Modal>
      )}

      {isSubnetModalOpen && (
        <Modal
          isOpen={isSubnetModalOpen}
          onClose={() => setIsSubnetModalOpen(false)}
          title="编辑网段 / 专线档案"
        >
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <FormInput
                label="网段名称"
                value={subnetFormData.name || ''}
                onChange={(e) => setSubnetFormData({ ...subnetFormData, name: e.target.value })}
                required
              />
            </div>
            <SmartInput
              label="运营商 / ISP"
              listId="isp-list"
              options={optionLists.isp}
              value={subnetFormData.isp || ''}
              onChange={(e) => setSubnetFormData({ ...subnetFormData, isp: e.target.value })}
              onManage={() => openOptionManager('isp')}
            />
            <SmartInput
              label="带宽"
              listId="bw-list"
              options={optionLists.bandwidth}
              value={subnetFormData.bandwidth || ''}
              onChange={(e) => setSubnetFormData({ ...subnetFormData, bandwidth: e.target.value })}
              onManage={() => openOptionManager('bandwidth')}
            />
            <FormInput
              label="电路编号"
              value={subnetFormData.circuit_id || ''}
              onChange={(e) => setSubnetFormData({ ...subnetFormData, circuit_id: e.target.value })}
            />
            <FormInput
              label="VLAN ID"
              value={subnetFormData.vlan_id || ''}
              onChange={(e) => setSubnetFormData({ ...subnetFormData, vlan_id: e.target.value })}
              placeholder="数字格式"
            />
            <FormInput
              label="地址范围 / CIDR"
              value={subnetFormData.cidr || ''}
              onChange={(e) => setSubnetFormData({ ...subnetFormData, cidr: e.target.value })}
              required
              placeholder="例如：192.168.1.0/24 或 210.21.7.185-210.21.7.190"
            />
            <FormInput
              label="网关地址"
              value={subnetFormData.gateway || ''}
              onChange={(e) => setSubnetFormData({ ...subnetFormData, gateway: e.target.value })}
            />
            <div className="col-span-2">
              <SmartInput
                label="物理部署位置"
                listId="loc-list"
                options={optionLists.location}
                value={subnetFormData.location || ''}
                onChange={(e) => setSubnetFormData({ ...subnetFormData, location: e.target.value })}
                onManage={() => openOptionManager('location')}
              />
            </div>
            <div className="col-span-2">
              <SmartInput
                label="核心用途"
                listId="func-list"
                options={optionLists.function}
                value={subnetFormData.function_usage || ''}
                onChange={(e) =>
                  setSubnetFormData({ ...subnetFormData, function_usage: e.target.value })
                }
                onManage={() => openOptionManager('function')}
              />
            </div>
          </div>
          <div className="mt-8 flex justify-end space-x-3 pt-5 border-t border-slate-100">
            <button
              onClick={() => setIsSubnetModalOpen(false)}
              className="px-5 py-2.5 text-sm text-slate-400 hover:bg-slate-50 rounded-xl font-bold transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveSubnet}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg font-bold flex items-center transition-all active:scale-95"
            >
              <Save className="w-4 h-4 mr-2" /> 保存变更
            </button>
          </div>
        </Modal>
      )}

      {isIPModalOpen && (
        <Modal
          isOpen={isIPModalOpen}
          onClose={() => setIsIPModalOpen(false)}
          title="编辑 IP 资产详情"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center">
                <Network className="w-3 h-3 mr-1" /> 基础网络信息
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="IP 地址"
                  value={ipFormData.ip_address || ''}
                  onChange={(e) => setIpFormData({ ...ipFormData, ip_address: e.target.value })}
                  required
                  placeholder="例如：10.128.1.10"
                />

                <div className="mb-4 relative">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      使用状态<span className="text-red-500 ml-1">*</span>
                    </label>
                  </div>
                  <div className="relative group">
                    <select
                      value={ipFormData.is_locked ? 'online' : ipFormData.status || 'online'}
                      onChange={(e) => setIpFormData({ ...ipFormData, status: e.target.value })}
                      disabled={ipFormData.is_locked}
                      className={`w-full bg-white border ${
                        ipFormData.is_locked
                          ? 'border-blue-200 bg-blue-50 text-blue-700 font-bold'
                          : 'border-slate-300'
                      } rounded-md px-3 py-2 text-sm outline-none appearance-none`}
                    >
                      <option value="online">在线 / 使用中</option>
                      <option value="offline">离线 / 空闲</option>
                      <option value="rogue">异常 / 违规</option>
                      <option value="reserved">保留地址</option>
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <FormInput
                    label="设备名称 / 主机名"
                    value={ipFormData.device_name || ''}
                    onChange={(e) => setIpFormData({ ...ipFormData, device_name: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest flex justify-between items-center">
                    设备类型
                    <button
                      onClick={() => openOptionManager('deviceTypes')}
                      className="text-blue-500 hover:underline"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </label>
                  <select
                    value={ipFormData.device_type || ''}
                    onChange={(e) => setIpFormData({ ...ipFormData, device_type: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="">-- 未分类 --</option>
                    {optionLists.deviceTypes.map((typeItem, index) => {
                      const value = typeof typeItem === 'object' ? typeItem.value : typeItem;
                      const label = typeof typeItem === 'object' ? typeItem.label : typeItem;
                      return (
                        <option key={index} value={value}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <FormInput
                  label="负责人 / 部门"
                  value={ipFormData.owner || ''}
                  onChange={(e) => setIpFormData({ ...ipFormData, owner: e.target.value })}
                />

                <div className="col-span-2">
                  <SmartInput
                    label="资产标签"
                    listId="hist-tags"
                    options={historyOptions.tag}
                    value={ipFormData.tag || ''}
                    onChange={(e) => setIpFormData({ ...ipFormData, tag: e.target.value })}
                    placeholder="例如：值班室、核心业务"
                  />
                </div>

                <div className="col-span-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`p-1.5 rounded-md mr-3 ${
                        ipFormData.is_locked
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">防误扫锁定（禁 Ping 设备）</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        开启后会强制保持在线状态，不会被扫描脚本误标为空闲。
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={ipFormData.is_locked || false}
                      onChange={(e) =>
                        setIpFormData({ ...ipFormData, is_locked: e.target.checked })
                      }
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <h4 className="text-xs font-bold text-orange-600 uppercase mb-3 flex items-center">
                <ArrowLeftRight className="w-3 h-3 mr-1" /> NAT 地址映射（可选）
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                    映射类型
                  </label>
                  <select
                    value={ipFormData.nat_type || 'none'}
                    onChange={(e) => setIpFormData({ ...ipFormData, nat_type: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-orange-100 outline-none"
                  >
                    <option value="none">无映射</option>
                    <option value="dnat">DNAT（入站）</option>
                    <option value="snat">SNAT（出站）</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <FormInput
                    label="映射公网 / 目标 IP"
                    value={ipFormData.nat_ip || ''}
                    onChange={(e) => setIpFormData({ ...ipFormData, nat_ip: e.target.value })}
                    placeholder="例如：120.236.x.x"
                  />
                </div>
                <div className="col-span-3">
                  <FormInput
                    label="端口映射规则"
                    value={ipFormData.nat_port || ''}
                    onChange={(e) => setIpFormData({ ...ipFormData, nat_port: e.target.value })}
                    placeholder="例如：80->8080, 443->8443（留空表示全部端口）"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                备注说明
              </label>
              <textarea
                value={ipFormData.description || ''}
                onChange={(e) => setIpFormData({ ...ipFormData, description: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none h-24 resize-none"
                placeholder="补充设备用途、访问说明或值班备注..."
              />
            </div>
          </div>
          <div className="mt-8 flex justify-end space-x-3 pt-5 border-t border-slate-100">
            <button
              onClick={() => setIsIPModalOpen(false)}
              className="px-5 py-2.5 text-sm text-slate-400 font-bold rounded-xl hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveIP}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg font-bold"
            >
              同步到数据库
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
