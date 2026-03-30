import React, { useState } from 'react';
import { FileSpreadsheet, TableProperties, Upload } from 'lucide-react';
import { Modal } from './common/UI';

export default function ImportWizardModal({ file, onClose, onConfirm }) {
  const [config, setConfig] = useState({
    sheetMapping: 'subnet',
    skipRows: 1,
    conflictMode: 'skip',
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="智能导入向导" size="lg">
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <FileSpreadsheet className="mt-1 h-6 w-6 text-blue-600" />
          <div>
            <h4 className="text-sm font-bold text-blue-800">已选择文件：{file.name}</h4>
            <p className="mt-1 text-xs text-blue-600">
              系统会识别 Excel 中的多个工作表，请先确认导入规则后再开始处理。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h5 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">基础规则</h5>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500">工作表识别方式</label>
              <select
                value={config.sheetMapping}
                onChange={(event) => setConfig({ ...config, sheetMapping: event.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="subnet">按网段归类</option>
                <option value="location">按位置归类</option>
                <option value="none">仅导入数据，不做自动映射</option>
              </select>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                例如工作表名称为“03办公网段”或“7F-弱电间”，系统会尝试映射到对应的业务区域或物理位置。
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500">数据起始行</label>
              <input
                type="number"
                min="1"
                value={config.skipRows}
                onChange={(event) =>
                  setConfig({ ...config, skipRows: Number.parseInt(event.target.value, 10) || 1 })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                如果前两行是总标题和字段说明，起始行可填写为 2 或 3。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">字段识别说明</h5>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-bold text-slate-700">标准字段自动映射</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pl-4 text-xs text-slate-600">
                <span className="rounded border bg-slate-100 px-2 py-1">IP 地址</span>
                <span className="rounded border bg-slate-100 px-2 py-1">MAC 地址</span>
                <span className="rounded border bg-slate-100 px-2 py-1">设备名称</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                <span className="text-sm font-bold text-slate-700">扩展字段保留导入</span>
              </div>
              <p className="pl-4 text-xs leading-6 text-slate-500">
                模板里未预定义的列，会作为补充信息一并导入，不会因为字段不在标准模板里而丢失。
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              <TableProperties className="mt-0.5 h-4 w-4 flex-shrink-0" />
              现在导入模板已经放宽校验，只要核心字段齐全，就能更灵活地兼容你现有的 Excel。
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500">IP 冲突处理</label>
            <select
              value={config.conflictMode}
              onChange={(event) => setConfig({ ...config, conflictMode: event.target.value })}
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <option value="skip">跳过已有记录</option>
              <option value="overwrite">覆盖现有信息</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              type="button"
            >
              取消
            </button>
            <button
              onClick={() => onConfirm(config)}
              className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              type="button"
            >
              <Upload className="mr-2 h-4 w-4" />
              开始导入
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
