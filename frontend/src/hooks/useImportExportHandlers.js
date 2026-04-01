import { useRef, useState } from 'react';

import { safeFetch } from '../lib/api';
import { buildDcimExportPayload, exportDcimHtmlReport, exportDcimImageReport } from '../lib/dcimExport';


export function useImportExportHandlers({
  activeLocation,
  alert,
  currentRacks,
  datacenterPowerStats,
  datacenters,
  extractResponseMessage,
  getRackCalculatedPower,
  refreshData,
}) {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [importContext, setImportContext] = useState('ipam');

  const handleExport = () => {
    window.open('/api/export-excel/', '_blank');
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setPendingFile(file);
    setImportWizardOpen(true);
    event.target.value = null;
  };

  const handleConfirmImport = async (config) => {
    if (!pendingFile) return;

    setIsImporting(true);
    setImportWizardOpen(false);

    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('config', JSON.stringify(config || {}));

    try {
      const endpoint = importContext === 'dcim' ? '/api/dcim/import-excel/' : '/api/import-excel/';
      const response = await safeFetch(endpoint, { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, importContext === 'dcim' ? '机房设备导入失败' : '导入失败'));
      }

      const data = await response.json();
      if (importContext === 'dcim') {
        alert(data.message || '机房设备导入完成。');
        refreshData('dcim');
      } else {
        const report = data.report;
        const warningText = Array.isArray(data.warnings) && data.warnings.length
          ? `\n预警：${data.warnings.slice(0, 3).join('；')}`
          : '';
        const summaryText = report
          ? `\n新增 ${report.create_rows}，覆盖 ${report.update_rows}，跳过 ${report.skipped_rows}，异常 ${report.invalid_rows}`
          : '';
        alert(`${data.message || '导入完成。'}${summaryText}${warningText}`);
        refreshData('list');
      }
    } catch (error) {
      alert(`${importContext === 'dcim' ? '机房设备导入失败' : '导入失败'}：${error.message}`);
    } finally {
      setPendingFile(null);
      setIsImporting(false);
    }
  };

  const handleImportClick = (context = 'ipam') => {
    setImportContext(context);
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = (context = 'ipam') => {
    const target = context === 'dcim' ? '/api/dcim/download-template/' : '/api/download-template/';
    window.open(target, '_blank');
  };

  const handleExportHtml = () => {
    try {
      const snapshot = buildDcimExportPayload({
        datacenters,
        activeLocation,
        racks: currentRacks,
        datacenterPowerStats,
        getRackCalculatedPower,
      });
      exportDcimHtmlReport(snapshot);
    } catch (error) {
      alert(`机房设备 HTML 导出失败：${error.message}`);
    }
  };

  const handleExportExcel = (context = 'ipam') => {
    window.open(context === 'dcim' ? '/api/dcim/export-excel/' : '/api/export-excel/', '_blank');
  };

  const handleExportImage = async () => {
    try {
      const snapshot = buildDcimExportPayload({
        datacenters,
        activeLocation,
        racks: currentRacks,
        datacenterPowerStats,
        getRackCalculatedPower,
      });
      exportDcimImageReport(snapshot);
    } catch (error) {
      alert(`机房设备图片导出失败：${error.message}`);
    }
  };

  return {
    fileInputRef,
    isImporting,
    importWizardOpen,
    pendingFile,
    importContext,
    handleExport,
    handleFileChange,
    handleConfirmImport,
    handleImportClick,
    handleDownloadTemplate,
    handleExportHtml,
    handleExportExcel,
    handleExportImage,
    closeImportWizard: () => {
      setImportWizardOpen(false);
      setPendingFile(null);
    },
  };
}
