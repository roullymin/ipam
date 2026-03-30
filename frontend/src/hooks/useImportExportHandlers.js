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

    if (importContext === 'dcim') {
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await safeFetch('/api/dcim/import-excel/', { method: 'POST', body: formData });
        if (!response.ok) {
          throw new Error(await extractResponseMessage(response, 'DCIM asset import failed'));
        }

        const data = await response.json();
        alert(data.message || 'DCIM asset import completed.');
        refreshData('dcim');
      } catch (error) {
        alert(`DCIM asset import failed: ${error.message}`);
      } finally {
        setIsImporting(false);
        event.target.value = null;
      }
      return;
    }

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
      const response = await safeFetch('/api/import-excel/', { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Import failed'));
      }

      const data = await response.json();
      alert(data.message || 'Import completed.');
      refreshData('list');
    } catch (error) {
      alert(`Import failed: ${error.message}`);
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
      alert(`DCIM HTML export failed: ${error.message}`);
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
      alert(`DCIM image export failed: ${error.message}`);
    }
  };

  return {
    fileInputRef,
    isImporting,
    importWizardOpen,
    pendingFile,
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
