import React from 'react';
import { ClipboardList, Copy, Download, FileSpreadsheet, Link2, QrCode, Upload } from 'lucide-react';

export default function ResidentRegistrationCard({
  registrationLink,
  importing,
  onCopyRegistrationLink,
  onDownloadRegistrationQr,
  onDownloadTemplate,
  onTriggerImport,
  onExportAllResidents,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            驻场公开登记入口
          </div>
          <div className="text-sm text-slate-500">
            这是固定公开表单地址，可直接复制或生成二维码分享给驻场人员填写，无需先在后台创建临时链接。
          </div>
          <div className="break-all font-mono text-xs text-slate-400">
            {registrationLink || '/?resident-intake=1'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCopyRegistrationLink}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            type="button"
          >
            <Link2 className="mr-2 inline h-4 w-4" />
            复制公开链接
          </button>
          <button
            onClick={onDownloadRegistrationQr}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            type="button"
          >
            <QrCode className="mr-2 inline h-4 w-4" />
            下载二维码
          </button>
          <button
            onClick={onDownloadTemplate}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            type="button"
          >
            <FileSpreadsheet className="mr-2 inline h-4 w-4" />
            下载模板
          </button>
          <button
            onClick={onTriggerImport}
            disabled={importing}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            type="button"
          >
            <Upload className="mr-2 inline h-4 w-4" />
            批量导入
          </button>
          <button
            onClick={onExportAllResidents}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            type="button"
          >
            <Download className="mr-2 inline h-4 w-4" />
            导出全部
          </button>
          <button
            onClick={onCopyRegistrationLink}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            type="button"
          >
            <Copy className="mr-2 inline h-4 w-4" />
            快速复制
          </button>
        </div>
      </div>
    </div>
  );
}
