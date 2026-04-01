import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, TableProperties, Upload } from 'lucide-react';

import { Modal } from './common/UI';
import { previewDcimImport, previewIpImport, previewResidentImport } from '../lib/api';

const CONTEXT_COPY = {
  ipam: {
    title: '智能导入向导',
    subtitle: '系统会先生成导入预览，确认编码、字段和冲突策略无误后再真正入库。',
    previewTitle: '导入预览',
    previewPendingText: '系统正在分析文件结构与编码。',
    ruleTitle: '基础规则',
    modeText: 'IP 台账',
  },
  dcim: {
    title: 'DCIM 导入预览',
    subtitle: '系统会先分析机房、机柜和设备记录，再决定是否执行批量更新。',
    previewTitle: '资产预览',
    previewPendingText: '系统正在分析机柜资产与设备资产工作表。',
    ruleTitle: '导入说明',
    modeText: '机房设备',
  },
  resident: {
    title: '驻场导入预览',
    subtitle: '系统会先分析人员主档、设备备案和匹配关系，确认后再执行批量写入。',
    previewTitle: '驻场预览',
    previewPendingText: '系统正在分析驻场人员与备案设备信息。',
    ruleTitle: '导入说明',
    modeText: '驻场人员',
  },
};

const actionLabel = (action) => {
  if (action === 'create') return '新增';
  if (action === 'update') return '覆盖';
  if (action === 'skip') return '跳过';
  return '异常';
};

const actionTone = (action) => {
  if (action === 'create') return 'text-emerald-600';
  if (action === 'update') return 'text-cyan-700';
  if (action === 'skip') return 'text-amber-700';
  return 'text-rose-700';
};

export default function ImportWizardModal({ file, onClose, onConfirm, context = 'ipam' }) {
  const [config, setConfig] = useState({
    sheetMapping: 'subnet',
    skipRows: 1,
    conflictMode: 'skip',
  });
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const copy = CONTEXT_COPY[context] || CONTEXT_COPY.ipam;
  const isDcim = context === 'dcim';
  const isResident = context === 'resident';

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError('');
      try {
        let response;
        if (isDcim) {
          response = await previewDcimImport({ file });
        } else if (isResident) {
          response = await previewResidentImport({ file });
        } else {
          response = await previewIpImport({ file, config });
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || '导入预览失败');
        }
        if (!cancelled) {
          setPreview(data);
        }
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(error.message);
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [config, file, isDcim, isResident]);

  const summary = preview?.preview?.summary;
  const rows = preview?.preview?.rows || [];
  const errors = preview?.preview?.errors || [];
  const warnings = preview?.preview?.warnings || [];
  const canImport = preview?.preview?.can_import && !previewError;

  return (
    <Modal isOpen={true} onClose={onClose} title={copy.title} size="xl">
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <FileSpreadsheet className="mt-1 h-6 w-6 text-blue-600" />
          <div>
            <h4 className="text-sm font-bold text-blue-800">已选择文件：{file.name}</h4>
            <p className="mt-1 text-xs text-blue-600">{copy.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <h5 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">{copy.ruleTitle}</h5>

              {!isDcim && !isResident ? (
                <>
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
                </>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div>当前模式：{copy.modeText}</div>
                  {isDcim ? (
                    <>
                      <div>默认按“机房名称 + 机柜编号”定位机柜，设备优先按固定资产编号匹配，其次按 U 位定位。</div>
                      <div>预览会提前指出缺少必填字段的行，以及设备引用了不存在机柜的情况。</div>
                    </>
                  ) : (
                    <>
                      <div>默认优先按登记编号匹配已有驻场人员；未提供登记编号时，会回退到“公司 + 姓名 + 联系方式”匹配。</div>
                      <div>预览会提前指出缺少必填字段的行，并展示每位人员将覆盖还是新增，以及备案设备数量。</div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h5 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">字段识别说明</h5>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="text-sm font-bold text-slate-700">
                    {isDcim ? '机房、机柜、设备主键识别' : '标准字段自动映射'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pl-4 text-xs text-slate-600">
                  {isDcim ? (
                    <>
                      <span className="rounded border bg-slate-100 px-2 py-1">机房名称</span>
                      <span className="rounded border bg-slate-100 px-2 py-1">机柜编号</span>
                      <span className="rounded border bg-slate-100 px-2 py-1">设备名称 / 资产编号</span>
                    </>
                  ) : isResident ? (
                    <>
                      <span className="rounded border bg-slate-100 px-2 py-1">登记编号</span>
                      <span className="rounded border bg-slate-100 px-2 py-1">公司 / 姓名</span>
                      <span className="rounded border bg-slate-100 px-2 py-1">联系方式</span>
                    </>
                  ) : (
                    <>
                      <span className="rounded border bg-slate-100 px-2 py-1">IP 地址</span>
                      <span className="rounded border bg-slate-100 px-2 py-1">MAC 地址</span>
                      <span className="rounded border bg-slate-100 px-2 py-1">设备名称</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  <span className="text-sm font-bold text-slate-700">
                    {isDcim ? '增量更新与覆盖' : '扩展字段保留导入'}
                  </span>
                </div>
                <p className="pl-4 text-xs leading-6 text-slate-500">
                  {isDcim
                    ? '预览会区分哪些记录会新增，哪些记录会覆盖现有机柜或设备信息。'
                    : isResident
                      ? '同一人员的多台设备会合并在一次导入里处理，预览会显示每位驻场人员计划覆盖还是新增。'
                      : '模板里未预定义的列，会作为补充信息一并导入，不会因为字段不在标准模板里而丢失。'}
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                <TableProperties className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {isDcim
                  ? '导入前先看预览，重点确认机房/机柜主键、设备匹配规则和缺失行。'
                  : isResident
                    ? '导入前先看预览，重点确认登记编号匹配、缺少公司/姓名的异常行，以及每位人员挂接的设备数量。'
                    : '现在导入模板已经放宽校验，只要核心字段齐全，就能更灵活地兼容你现有的 Excel。'}
              </div>
            </div>

            {!isDcim && !isResident ? (
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
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-slate-800">{copy.previewTitle}</h5>
                <p className="mt-1 text-xs text-slate-500">
                  {preview?.detected_encoding ? `检测编码：${preview.detected_encoding}` : copy.previewPendingText}
                </p>
              </div>
              {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-600" /> : null}
            </div>

            {previewError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {previewError}
              </div>
            ) : null}

            {summary ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {isDcim ? '机柜行' : isResident ? '人员行' : '总行数'}
                  </div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    {isDcim ? summary.rack_rows : isResident ? summary.resident_rows : summary.total_rows}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">
                    {isDcim ? '设备行' : isResident ? '备案设备' : '可导入'}
                  </div>
                  <div className="mt-2 text-xl font-black text-emerald-700">
                    {isDcim ? summary.device_rows : isResident ? summary.device_rows : summary.actionable_rows}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-500">
                    {isDcim || isResident ? '将更新' : '将跳过'}
                  </div>
                  <div className="mt-2 text-xl font-black text-amber-700">
                    {isDcim
                      ? summary.rack_update_rows + summary.device_update_rows
                      : isResident
                        ? summary.update_rows
                        : summary.skip_rows}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">异常行</div>
                  <div className="mt-2 text-xl font-black text-rose-700">{summary.invalid_rows}</div>
                </div>
              </div>
            ) : null}

            {errors.length > 0 ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                  导入前必须处理的问题
                </div>
                <div className="mt-2 space-y-1 text-xs leading-5 text-rose-700">
                  {errors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-bold text-amber-700">预警</div>
                <div className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                  {warnings.slice(0, 4).map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className={`grid gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 ${
                isDcim || isResident ? 'grid-cols-[5rem_6rem_1fr_9rem]' : 'grid-cols-[5rem_8rem_1fr_7rem]'
              }`}>
                <span>行号</span>
                <span>动作</span>
                <span>{isDcim ? '对象' : isResident ? '人员 / 公司' : '设备 / IP'}</span>
                <span>{isDcim ? '定位' : isResident ? '项目 / 部门' : '网段'}</span>
              </div>
              <div className="custom-scrollbar max-h-72 overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">暂无可展示的预览行。</div>
                ) : (
                  rows.map((row) => (
                    <div
                      key={`${row.sheet || 'sheet'}-${row.row_number}-${row.ip_address || row.title}`}
                      className={`grid gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 ${
                        isDcim || isResident ? 'grid-cols-[5rem_6rem_1fr_9rem]' : 'grid-cols-[5rem_8rem_1fr_7rem]'
                      }`}
                    >
                      <span className="font-semibold text-slate-500">{row.row_number}</span>
                      <span className={`font-semibold ${actionTone(row.action)}`}>{actionLabel(row.action)}</span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">
                          {row.title || row.device_name || '未填写设备名称'}
                        </div>
                        <div className="truncate text-xs text-slate-500">{row.subtitle || row.ip_address}</div>
                      </div>
                      <span className="truncate text-xs text-slate-500">
                        {isDcim || isResident ? row.sheet || row.reason || '未定位' : row.subnet?.cidr || '未匹配'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-slate-500">
            {canImport ? '预览通过，可以执行导入。' : '请先修复预览中提示的问题，再执行导入。'}
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
              disabled={!canImport || isPreviewLoading}
              className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
            >
              {isPreviewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              确认导入
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
