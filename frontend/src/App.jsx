import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Server, ShieldCheck, Search, RefreshCw, Folder, Network,
  ChevronRight, ChevronDown, Edit2, Trash2,
  X, Save, Plus, Upload, Download, Lock,
  MapPin, Box, Shield, Activity, Users, Database, Settings,
  AlertTriangle, CheckCircle2, Grid as GridIcon, List as ListIcon, Loader2, 
  ArrowLeftRight,
  Zap, Calculator, HardDrive, AlignLeft, Info,
  ZoomIn, ZoomOut, Maximize, Image as ImageIcon, FileText,
  AlignJustify, Columns, Code, Tag, LayoutDashboard, TrendingUp, FileSpreadsheet, HelpCircle,
  TableProperties, Filter 
} from 'lucide-react';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import AuthManagementModals from './components/AuthManagementModals';
import BackupView from './components/BackupView';
import DatacenterChangeRequestView from './components/DatacenterChangeRequestView';
import DcimView from './components/DcimView';
import DcimOverviewPage from './components/DcimOverviewPage';
import { DatacenterModal, DeviceModal, RackModal } from './components/DcimManagementModals';
import DashboardView from './components/DashboardView';
import ErrorBoundary from './components/ErrorBoundary';
import ImportWizardModal from './components/ImportWizardModal';
import IpamView from './components/IpamView';
import LoginScreen from './components/LoginScreen';
import NetworkManagementModals from './components/NetworkManagementModals';
import ResidentIntakePage from './components/ResidentIntakePage';
import ResidentManagementView from './components/ResidentManagementView';
import SecurityCenterView from './components/SecurityCenterView';
import SystemStatusModal from './components/SystemStatusModal';
import UserManagementView from './components/UserManagementView';
import {
  ConfirmActionModal,
  DebugModal,
  FormInput,
  Modal,
  NotificationCenter,
  OptionManagerModal,
  SmartInput,
  StatusBadge,
} from './components/common/UI';
import { safeFetch } from './lib/api';
import { BRAND } from './lib/brand';
import { useAuthSession } from './hooks/useAuthSession';
import { useAppDataLoader } from './hooks/useAppDataLoader';
import { useDcimDerivedData, useDcimViewState } from './hooks/useDcimViewState';
import { useImportExportHandlers } from './hooks/useImportExportHandlers';
import { useIpamDerivedData, useIpamViewActions, useIpamViewState } from './hooks/useIpamViewState';
import { useSystemOverview } from './hooks/useSystemOverview';
import { useUserManagementHandlers } from './hooks/useUserManagementHandlers';

// ============================================================================
// 1. Base constants and configuration
// ============================================================================

const DEFAULT_OPTIONS = {
  isp: ['\u4e2d\u56fd\u7535\u4fe1', '\u4e2d\u56fd\u79fb\u52a8', '\u4e2d\u56fd\u8054\u901a', '\u4e2d\u56fd\u5e7f\u7535', '\u653f\u52a1\u5916\u7f51', '\u6307\u6325\u4e13\u7f51', '\u81ea\u5efa\u5149\u7ea4'],
  bandwidth: ['10M', '50M', '100M', '500M', '1000M', '10G', '40G', '100G'],
  location: ['\u6838\u5fc3\u673a\u623f-3F', '\u6838\u5fc3\u673a\u623f-A\u533a', '\u6307\u6325\u4e2d\u5fc3\u5927\u697c', '7F-\u5f31\u7535\u95f4', '1F-\u6d88\u9632\u63a7\u5236\u5ba4'],
  function: ['\u4e1a\u52a1\u63a5\u5165', '\u653f\u52a1\u5916\u7f51\u51fa\u53e3', '\u4fe1\u606f\u53d1\u5e03', '\u5b89\u5168\u9632\u62a4', '\u529e\u516c\u7f51\u7edc', '\u5907\u7528\u94fe\u8def'],
  deviceTypes: [
    { value: 'server', label: '\u670d\u52a1\u5668' },
    { value: 'vm', label: '\u865a\u62df\u673a' },
    { value: 'switch_core', label: '\u6838\u5fc3\u4ea4\u6362\u673a' },
    { value: 'switch_access', label: '\u63a5\u5165\u4ea4\u6362\u673a' },
    { value: 'router', label: '\u8def\u7531\u5668' },
    { value: 'firewall', label: '\u9632\u706b\u5899' },
    { value: 'storage', label: '\u5b58\u50a8\u8bbe\u5907' },
    { value: 'ups', label: 'UPS \u7535\u6e90' },
    { value: 'pdu', label: 'PDU \u7535\u6e90' },
    { value: 'odf', label: 'ODF \u914d\u7ebf\u67b6' },
    { value: 'pc', label: 'PC \u7ec8\u7aef' },
    { value: 'printer', label: '\u6253\u5370\u673a' },
    { value: 'other', label: '\u5176\u4ed6\u8bbe\u5907' },
  ]
};

const ROLE_DEFINITIONS = {
  admin: { label: '\u8d85\u7ea7\u7ba1\u7406\u5458', permissions: ['dashboard', 'list', 'dcim', 'changes', 'resident', 'security', 'backup', 'users'] },
  dc_operator: { label: '\u673a\u623f\u8fd0\u7ef4', permissions: ['dashboard', 'dcim', 'changes', 'resident'] },
  ip_manager: { label: 'IP \u7ba1\u7406\u5458', permissions: ['dashboard', 'list'] },
  auditor: { label: '\u5ba1\u8ba1\u5458', permissions: ['dashboard', 'changes', 'security', 'resident'] },
  guest: { label: '\u8bbf\u5ba2', permissions: ['dashboard', 'list', 'dcim'] },
};

const TAB_CONFIG = {
  dashboard: { icon: LayoutDashboard, label: BRAND.navigation.dashboard },
  list: { icon: Server, label: BRAND.navigation.list },
  dcim: { icon: Box, label: BRAND.navigation.dcim },
  changes: { icon: ArrowLeftRight, label: BRAND.navigation.changes || '设备变更' },
  resident: { icon: Users, label: BRAND.navigation.resident },
  security: { icon: Shield, label: BRAND.navigation.security },
  backup: { icon: Database, label: BRAND.navigation.backup },
  users: { icon: Users, label: BRAND.navigation.users }
};

const HISTORY_TRACKED_FIELDS = [
  'projects', 'contacts', 'brands', 'models', 'suppliers', 'os_versions',
  'specs', 'power_usage', 'typical_power', 'purchase_date', 'warranty_date',
  'tag'
];

const HISTORY_FIELD_ALIASES = {
  projects: 'project',
  contacts: 'contact',
  brands: 'brand',
  models: 'model',
  suppliers: 'supplier',
  os_versions: 'os_version',
  specs: 'specs',
  power_usage: 'power_usage',
  typical_power: 'typical_power',
  purchase_date: 'purchase_date',
  warranty_date: 'warranty_date',
  tag: 'tag',
};

const STATUS_STYLES = {
  online: { label: '\u5728\u7ebf / \u6d3b\u8dc3', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  offline: { label: '\u79bb\u7ebf / \u672a\u54cd\u5e94', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
  rogue: { label: '\u5f02\u5e38 / \u98ce\u9669', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  reserved: { label: '\u4fdd\u7559\u5730\u5740', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  free: { label: '\u7a7a\u95f2', bg: 'bg-white', text: 'text-slate-300', border: 'border-slate-100', dot: 'bg-slate-200' },
};

const DEVICE_STATUS = {
  active: { label: '\u8fd0\u884c\u4e2d', color: 'text-green-600 bg-green-50 border-green-200' },
  offline: { label: '\u79bb\u7ebf', color: 'text-gray-500 bg-gray-100 border-gray-200' },
  maintenance: { label: '\u7ef4\u62a4\u4e2d', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  planned: { label: '\u89c4\u5212\u4e2d', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  retired: { label: '\u5df2\u9000\u5f79', color: 'text-red-600 bg-red-50 border-red-200' },
};

// ============================================================================
// 2. Shared helpers
// ============================================================================
const safeInt = (val, def = 0) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? def : parsed;
};

const extractResponseMessage = async (response, fallback = 'Operation failed') => {
  try {
    const data = await response.clone().json();
    if (typeof data === 'string') return data;
    return data.detail || data.message || data.error || JSON.stringify(data);
  } catch (jsonError) {
    try {
      const text = await response.text();
      return text || fallback;
    } catch (textError) {
      return fallback;
    }
  }
};

// ============================================================================
// Main application shell
// ============================================================================

function MainApp() {
  const {
    isLoggedIn,
    currentUser,
    currentUserInfo,
    isAuthChecking,
    handleLogout,
    completeLogin,
    updateCurrentUserInfo,
  } = useAuthSession();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [debugLogs, setDebugLogs] = useState([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isSystemStatusOpen, setIsSystemStatusOpen] = useState(false);
  const currentRole = currentUserInfo?.role || (currentUser === 'admin' ? 'admin' : 'guest');
  const currentPermissions = ROLE_DEFINITIONS[currentRole]?.permissions || [];
  const currentUserDisplay = currentUserInfo?.display_name || currentUserInfo?.username || currentUser;
  const isResidentIntakeMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('resident-intake') === '1';
  const isDcOverviewMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dc-overview') === '1';

  useEffect(() => {
    if (currentUserInfo?.must_change_password) {
      setIsPasswordChangeModalOpen(true);
    }
  }, [currentUserInfo?.must_change_password]);

  useEffect(() => {
    if (isLoggedIn && !currentPermissions.includes(activeTab)) {
      const firstAllowed = Object.keys(TAB_CONFIG).find(key => currentPermissions.includes(key));
      if (firstAllowed) {
        setActiveTab(firstAllowed);
      }
    }
  }, [activeTab, currentPermissions, isLoggedIn]);

  const addDebugLog = (action, content, type = 'info') => {
    const entry = { id: Date.now(), time: new Date().toLocaleTimeString(), action, content, type };
    setDebugLogs(prev => [entry, ...prev].slice(0, 50));
    console.log(`[Debug/${action}]`, content);
  };

  const [optionLists, setOptionLists] = useState(() => {
    try {
      const saved = localStorage.getItem('ipam_options');
      return saved ? JSON.parse(saved) : DEFAULT_OPTIONS;
    } catch(e) {
      return DEFAULT_OPTIONS;
    }
  });

  const [historyOptions, setHistoryOptions] = useState(() => {
      try {
          const saved = localStorage.getItem('app_history_options');
          const parsed = saved ? JSON.parse(saved) : {};
          const initialHistory = {};
          HISTORY_TRACKED_FIELDS.forEach(key => {
              const legacyKey = HISTORY_FIELD_ALIASES[key];
              initialHistory[key] = parsed[key] || parsed[legacyKey] || [];
          });
          return initialHistory;
      } catch(e) {
          const initialHistory = {};
          HISTORY_TRACKED_FIELDS.forEach(key => initialHistory[key] = []);
          return initialHistory;
      }
  });

  useEffect(() => { localStorage.setItem('ipam_options', JSON.stringify(optionLists)); }, [optionLists]);

  const updateHistory = (formData) => {
      setHistoryOptions(prev => {
          const newHistory = { ...prev };
          const updateList = (list, item) => {
              if (!item || item === 0 || item === '0') return list;
              const strItem = String(item).trim();
              if (!strItem) return list;
              const newList = [strItem, ...(list || []).filter(i => String(i) !== strItem)].slice(0, 5);
              return newList;
          };
          HISTORY_TRACKED_FIELDS.forEach(key => {
             const sourceKey = HISTORY_FIELD_ALIASES[key] || key;
             if (formData[sourceKey]) {
               newHistory[key] = updateList(prev[key], formData[sourceKey]);
             }
          });
          localStorage.setItem('app_history_options', JSON.stringify(newHistory));
          return newHistory;
      });
  };

  const [isIPModalOpen, setIsIPModalOpen] = useState(false);
  const [isSubnetModalOpen, setIsSubnetModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState('create');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [isDcModalOpen, setIsDcModalOpen] = useState(false);
  const [isPasswordChangeModalOpen, setIsPasswordChangeModalOpen] = useState(false);
  const [managingOptionKey, setManagingOptionKey] = useState(null);

  const [editingIP, setEditingIP] = useState(null);
  const [ipFormData, setIpFormData] = useState({});
  const [subnetFormData, setSubnetFormData] = useState({});
  const [sectionFormData, setSectionFormData] = useState({});
  const [userFormData, setUserFormData] = useState({});
  const [resetTarget, setResetTarget] = useState({});
  const [blockFormData, setBlockFormData] = useState({});
  const [passwordFormData, setPasswordFormData] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const [notifications, setNotifications] = useState([]);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '\u8bf7\u786e\u8ba4\u672c\u6b21\u64cd\u4f5c',
    message: '',
    confirmLabel: '\u786e\u8ba4\u6267\u884c',
    tone: 'danger',
  });
  const confirmResolverRef = useRef(null);

  const dismissNotification = React.useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = React.useCallback((message, type = 'info', title = '') => {
    const text = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
    const id = Date.now() + Math.random();
    setNotifications((prev) => [
      ...prev,
      { id, type, title, message: text },
    ]);
    window.setTimeout(() => dismissNotification(id), 4200);
  }, [dismissNotification]);

  const alert = React.useCallback((message, type = 'info') => {
    const text = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
    let resolvedType = type;
    if (type === 'info') {
      const lowerText = text.toLowerCase();
      const successHints = ['success', 'saved', 'created', 'updated', 'deleted', 'completed', 'restored', 'imported'];
      const errorHints = ['error', 'failed', 'invalid', 'denied', 'forbidden', 'unauthorized', 'exception'];
      if (successHints.some((hint) => lowerText.includes(hint))) resolvedType = 'success';
      else if (errorHints.some((hint) => lowerText.includes(hint))) resolvedType = 'error';
    }
    notify(text, resolvedType);
    return false;
  }, [notify]);

  const closeConfirm = React.useCallback((confirmed) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(confirmed);
      confirmResolverRef.current = null;
    }
    setConfirmState({
      isOpen: false,
      title: '\u8bf7\u786e\u8ba4\u672c\u6b21\u64cd\u4f5c',
      message: '',
      confirmLabel: '\u786e\u8ba4\u6267\u884c',
      tone: 'danger'
    });
  }, []);

  const confirmAction = React.useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        isOpen: true,
        title: options.title || '\u8bf7\u786e\u8ba4\u672c\u6b21\u64cd\u4f5c',
        message,
        confirmLabel: options.confirmLabel || '\u786e\u8ba4\u6267\u884c',
        tone: options.tone || 'danger'
      });
    });
  }, []);
  const getRackCalculatedPower = (rackId) => {
      if (!Array.isArray(rackDevices)) return { rated_sum: 0, typical_sum: 0 };
    const devicesInRack = rackDevices.filter(d => String(d.rack) === String(rackId));
      return devicesInRack.reduce((acc, dev) => ({ rated_sum: acc.rated_sum + (safeInt(dev.power_usage) || 0), typical_sum: acc.typical_sum + (safeInt(dev.typical_power) || 0) }), { rated_sum: 0, typical_sum: 0 });
  };

  const {
    ipViewMode,
    setIpViewMode,
    selectedSubnetId,
    setSelectedSubnetId,
    expandedSections,
    setExpandedSections,
    searchQuery,
    setSearchQuery,
    tagFilter,
    setTagFilter,
  } = useIpamViewState();

  const {
    dcimViewMode,
    setDcimViewMode,
    elevationLayout,
    setElevationLayout,
    activeLocation,
    setActiveLocation,
    selectedRack,
    setSelectedRack,
    currentRackForm,
    setCurrentRackForm,
    currentDcForm,
    setCurrentDcForm,
    editingDevice,
    setEditingDevice,
    viewState,
    elevationScrollRef,
    elevationContentRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleElevationMouseDown,
    handleElevationMouseLeave,
    handleElevationMouseUp,
    handleElevationMouseMove,
    handleJumpToDc,
  } = useDcimViewState();

  const {
    sections,
    subnets,
    ips,
    backups,
    backupSummary,
    users,
    residentStaff,
    loginLogs,
    auditLogs,
    blocklist,
    datacenters,
    racks,
    rackDevices,
    isDataLoading,
    refreshData,
  } = useAppDataLoader({
    activeTab,
    isLoggedIn,
    activeLocation,
    setActiveLocation,
    selectedSubnetId,
    setSelectedSubnetId,
    safeInt,
  });

  const {
    overview: systemOverview,
    version: backendVersion,
    isLoading: isSystemOverviewLoading,
    lastRefreshedAt: systemOverviewRefreshedAt,
    refreshOverview,
  } = useSystemOverview(isLoggedIn);

  const {
    isScanning,
    handleScanSubnet,
    handlePoolIPClick,
  } = useIpamViewActions({
    selectedSubnetId,
    safeFetch,
    refreshData,
    alert,
    extractResponseMessage,
    setIsIPModalOpen,
    setEditingIP,
    setIpFormData,
  });

  const { currentSubnet, filteredIPs, uniqueTags } = useIpamDerivedData({
    ips,
    subnets,
    selectedSubnetId,
    searchQuery,
    tagFilter,
  });
  const { currentRacks, datacenterPowerStats } = useDcimDerivedData({
    racks,
    activeLocation,
    getRackCalculatedPower,
    safeInt,
  });

  const {
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
    closeImportWizard,
  } = useImportExportHandlers({
    activeLocation,
    alert,
    currentRacks,
    datacenterPowerStats,
    datacenters,
    extractResponseMessage,
    getRackCalculatedPower,
    refreshData,
  });

  const handleSaveIP = async () => {
    if (!ipFormData.ip_address) {
      alert('IP 地址不能为空。');
      return;
    }

    const url = editingIP ? `/api/ips/${editingIP.id}/` : '/api/ips/';
    const method = editingIP ? 'PUT' : 'POST';
    const cleanDesc = (ipFormData.description || '')
      .replace(/__TAG__:(.*)$/m, '')
      .replace(/__LOCKED__:(true|false)/m, '')
      .trim();

    let hiddenMeta = '';
    if (ipFormData.tag) hiddenMeta += `\n__TAG__:${ipFormData.tag}`;
    if (ipFormData.is_locked) hiddenMeta += '\n__LOCKED__:true';

    const payload = {
      ...ipFormData,
      subnet: selectedSubnetId,
      nat_type: ipFormData.nat_type || 'none',
      status: ipFormData.is_locked ? 'online' : (ipFormData.status || 'online'),
      description: cleanDesc + hiddenMeta,
    };
    delete payload.is_locked;

    try {
      const response = await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to save IP record'));
      }

      if (ipFormData.tag) {
        updateHistory({ tag: ipFormData.tag });
      }
      alert(editingIP ? 'IP 记录已更新。' : 'IP 记录已创建。');
      setIsIPModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`保存 IP 记录失败：${error.message}`);
    }
  };

  const handleDeleteIP = async (id) => {
    if (!confirm('确定删除这条 IP 记录吗？')) return;
    try {
      const response = await safeFetch(`/api/ips/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除 IP 记录失败'));
      }
      refreshData();
    } catch (error) {
      alert(`删除 IP 记录失败：${error.message}`);
    }
  };

  const openOptionManager = (key) => setManagingOptionKey(key);

  const {
    closeUserModal,
    handleOpenCreateUser,
    handleOpenEditUser,
    handleSaveUser,
    handleDeleteUser,
    handleToggleUserActive,
    handleUnlockUser,
    handleResetConfirm,
    handleChangeOwnPassword,
  } = useUserManagementHandlers({
    alert,
    currentUserInfo,
    extractResponseMessage,
    passwordFormData,
    refreshData,
    resetTarget,
    setIsPasswordChangeModalOpen,
    setIsResetModalOpen,
    setIsUserModalOpen,
    setPasswordFormData,
    setResetTarget,
    setUserFormData,
    setUserModalMode,
    updateCurrentUserInfo,
    userFormData,
    userModalMode,
  });

  const handleSaveSubnet = async () => {
    if (!subnetFormData.name) {
      alert('子网名称不能为空。');
      return;
    }

    const url = subnetFormData.id ? `/api/subnets/${subnetFormData.id}/` : '/api/subnets/';
    const payload = {
      ...subnetFormData,
      vlan_id: subnetFormData.vlan_id !== '' && subnetFormData.vlan_id != null
        ? parseInt(subnetFormData.vlan_id, 10)
        : null,
    };

    try {
      const response = await safeFetch(url, {
        method: subnetFormData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '保存子网失败'));
      }
      alert(subnetFormData.id ? '子网已更新。' : '子网已创建。');
      setIsSubnetModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`保存子网失败：${error.message}`);
    }
  };

  const handleSaveSection = async () => {
    if (!sectionFormData.name) {
      alert('网络分区名称不能为空。');
      return;
    }

    try {
      const response = await safeFetch('/api/sections/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionFormData),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '保存网络分区失败'));
      }
      alert('网络分区已创建。');
      setIsSectionModalOpen(false);
      setSectionFormData({});
      refreshData();
    } catch (error) {
      alert(`保存网络分区失败：${error.message}`);
    }
  };

  const handleDeleteSection = async (id) => {
    if (!confirm('确定删除这个网络分区吗？')) return;
    try {
      const response = await safeFetch(`/api/sections/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除网络分区失败'));
      }
      refreshData();
    } catch (error) {
      alert(`删除网络分区失败：${error.message}`);
    }
  };

  const handleDeleteSubnet = async (id) => {
    if (!confirm('确定删除这个子网吗？')) return;
    try {
      const response = await safeFetch(`/api/subnets/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除子网失败'));
      }
      setSelectedSubnetId(null);
      refreshData();
    } catch (error) {
      alert(`删除子网失败：${error.message}`);
    }
  };

  const handleSaveDatacenter = async (formData) => {
    const url = formData.id ? `/api/datacenters/${formData.id}/` : '/api/datacenters/';
    try {
      const response = await safeFetch(url, {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '保存机房失败'));
      }
      alert(formData.id ? '机房已更新。' : '机房已创建。');
      setIsDcModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`保存机房失败：${error.message}`);
    }
  };

  const handleDeleteDatacenter = async (id) => {
    if (!confirm('确定删除这个机房吗？')) return;
    try {
      const response = await safeFetch(`/api/datacenters/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除机房失败'));
      }
      if (activeLocation === id) setActiveLocation(null);
      refreshData();
    } catch (error) {
      alert(`删除机房失败：${error.message}`);
    }
  };

  const handleSaveRack = async (formData) => {
    const url = formData.id ? `/api/racks/${formData.id}/` : '/api/racks/';
    const method = formData.id ? 'PUT' : 'POST';
    const pduMeta = {
      count: safeInt(formData.pdu_count, 2),
      power: safeInt(formData.pdu_power, 0),
    };
    const cleanDesc = (formData.description || '').replace(/__PDU_META__:({.*})$/m, '').trim();
    const description = cleanDesc
      ? `${cleanDesc}\n__PDU_META__:${JSON.stringify(pduMeta)}`
      : `__PDU_META__:${JSON.stringify(pduMeta)}`;
    const payload = {
      ...formData,
      datacenter: activeLocation,
      description,
    };
    delete payload.pdu_count;
    delete payload.pdu_power;
    delete payload.pdu_a_power;
    delete payload.pdu_b_power;

    try {
      const response = await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '保存机柜失败'));
      }
      alert(formData.id ? '机柜已更新。' : '机柜已创建。');
      setIsRackModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`保存机柜失败：${error.message}`);
    }
  };

  const handleDeleteRack = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除这个机柜吗？')) return;
    try {
      const response = await safeFetch(`/api/racks/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除机柜失败'));
      }
      if (selectedRack?.id === id) setSelectedRack(null);
      refreshData();
    } catch (error) {
      alert(`删除机柜失败：${error.message}`);
    }
  };

  const handleSaveDevice = async (deviceData) => {
    const url = deviceData.id ? `/api/rack-devices/${deviceData.id}/` : '/api/rack-devices/';
    const cleanData = { ...deviceData };
    if (!cleanData.purchase_date) cleanData.purchase_date = null;
    if (!cleanData.warranty_date) cleanData.warranty_date = null;
    cleanData.power_usage = safeInt(cleanData.power_usage);
    cleanData.typical_power = safeInt(cleanData.typical_power);
    cleanData.position = safeInt(cleanData.position, 1);
    cleanData.u_height = safeInt(cleanData.u_height, 1);

    const payload = { ...cleanData, rack: selectedRack.id };

    try {
      const response = await safeFetch(url, {
        method: deviceData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '保存设备失败'));
      }
      updateHistory(deviceData);
      alert(deviceData.id ? '设备已更新。' : '设备已创建。');
      setEditingDevice(null);
      refreshData();
    } catch (error) {
      alert(`保存设备失败：${error.message}`);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!confirm('确定删除这台设备吗？')) return;
    try {
      const response = await safeFetch(`/api/rack-devices/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除设备失败'));
      }
      setEditingDevice(null);
      refreshData();
    } catch (error) {
      alert(`删除设备失败：${error.message}`);
    }
  };

  const handleManualBackup = async () => {
    try {
      const response = await safeFetch('/api/trigger-backup/', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || '手动备份失败');
      }
      alert(`备份已创建：${data.filename}`);
      refreshData('backup');
    } catch (error) {
      alert(`手动备份失败：${error.message}`);
    }
  };

  const handleDownloadBackup = (filename) => {
    window.open(`/api/backup/download/?filename=${encodeURIComponent(filename)}`, '_blank');
  };

  const handleBlockIP = async () => {
    if (!blockFormData.ip_address) {
      alert('IP 地址不能为空。');
      return;
    }
    try {
      const response = await safeFetch('/api/blocklist/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockFormData),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '添加黑名单失败'));
      }
      alert('黑名单记录已创建。');
      setIsBlockModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`添加黑名单失败：${error.message}`);
    }
  };

  const handleUnblockIP = async (id) => {
    if (!confirm('确定移除这条黑名单记录吗？')) return;
    try {
      const response = await safeFetch(`/api/blocklist/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '移除黑名单失败'));
      }
      refreshData();
    } catch (error) {
      alert(`移除黑名单失败：${error.message}`);
    }
  };

  if (isAuthChecking) {
      return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">正在检查登录状态...</div>;
  }

  if (isDcOverviewMode) {
      return <DcimOverviewPage />;
  }

  if (!isLoggedIn && isResidentIntakeMode) {
      return <ResidentIntakePage />;
  }

  if (!isLoggedIn) return <LoginScreen onLogin={completeLogin} />;

  return (
    <div className="app-shell flex h-screen text-slate-800 font-sans overflow-hidden"
         onMouseUp={handleElevationMouseUp}
         onMouseLeave={handleElevationMouseLeave}
         onMouseMove={handleElevationMouseMove}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" className="hidden" />
        <AppSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabConfig={TAB_CONFIG}
          currentPermissions={currentPermissions}
          currentUser={currentUserDisplay}
          currentRoleLabel={ROLE_DEFINITIONS[currentRole]?.label}
          onLogout={handleLogout}
          overview={systemOverview}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-transparent">
          <AppHeader
            activeLabel={TAB_CONFIG[activeTab]?.label || BRAND.navigation.dashboard}
            currentUser={currentUserDisplay}
            currentRoleLabel={ROLE_DEFINITIONS[currentRole]?.label}
            onOpenDebug={() => setIsDebugOpen(true)}
            onOpenPasswordChange={() => setIsPasswordChangeModalOpen(true)}
            onOpenSystemStatus={() => setIsSystemStatusOpen(true)}
            overview={systemOverview}
          />

        <div className="flex-1 overflow-hidden relative">
          
          {activeTab === 'dashboard' && (
             <DashboardView 
                datacenters={datacenters} 
                racks={racks} 
                rackDevices={rackDevices} 
                ips={ips} 
                logs={loginLogs} 
                residentStaff={residentStaff}
                overview={systemOverview}
                lastRefreshedAt={systemOverviewRefreshedAt}
                onJumpToDc={(dcId) => handleJumpToDc(dcId, setActiveTab)}
             />
          )}

          {activeTab === 'list' && (
            <IpamView
              sections={sections}
              expandedSections={expandedSections}
              setExpandedSections={setExpandedSections}
              setSectionFormData={setSectionFormData}
              setIsSectionModalOpen={setIsSectionModalOpen}
              setSubnetFormData={setSubnetFormData}
              setIsSubnetModalOpen={setIsSubnetModalOpen}
              handleDeleteSection={handleDeleteSection}
              subnets={subnets}
              selectedSubnetId={selectedSubnetId}
              setSelectedSubnetId={setSelectedSubnetId}
              handleDeleteSubnet={handleDeleteSubnet}
              currentSubnet={currentSubnet}
              ipViewMode={ipViewMode}
              setIpViewMode={setIpViewMode}
              handleScanSubnet={handleScanSubnet}
              isScanning={isScanning}
              setIpFormData={setIpFormData}
              setEditingIP={setEditingIP}
              setIsIPModalOpen={setIsIPModalOpen}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
              uniqueTags={uniqueTags}
              handleDownloadTemplate={handleDownloadTemplate}
              handleImportClick={handleImportClick}
              isImporting={isImporting}
              handleExport={handleExport}
              filteredIPs={filteredIPs}
              optionLists={optionLists}
              handleDeleteIP={handleDeleteIP}
              handlePoolIPClick={handlePoolIPClick}
            />
          )}

          {activeTab === 'dcim' && (
            <DcimView
              datacenters={datacenters}
              activeLocation={activeLocation}
              setActiveLocation={setActiveLocation}
              setCurrentDcForm={setCurrentDcForm}
              setIsDcModalOpen={setIsDcModalOpen}
              handleDeleteDatacenter={handleDeleteDatacenter}
              dcimViewMode={dcimViewMode}
              setDcimViewMode={setDcimViewMode}
              elevationLayout={elevationLayout}
              setElevationLayout={setElevationLayout}
              handleDownloadTemplate={handleDownloadTemplate}
              handleImportClick={handleImportClick}
              isImporting={isImporting}
              handleExportExcel={handleExportExcel}
              handleExportHtml={handleExportHtml}
              handleExportImage={handleExportImage}
              setCurrentRackForm={setCurrentRackForm}
              setIsRackModalOpen={setIsRackModalOpen}
              datacenterPowerStats={datacenterPowerStats}
              currentRacks={currentRacks}
              getRackCalculatedPower={getRackCalculatedPower}
              selectedRack={selectedRack}
              setSelectedRack={setSelectedRack}
              handleDeleteRack={handleDeleteRack}
              setEditingDevice={setEditingDevice}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              handleZoomReset={handleZoomReset}
              elevationScrollRef={elevationScrollRef}
              elevationContentRef={elevationContentRef}
              handleElevationMouseDown={handleElevationMouseDown}
              handleElevationMouseLeave={handleElevationMouseLeave}
              handleElevationMouseUp={handleElevationMouseUp}
              handleElevationMouseMove={handleElevationMouseMove}
              viewState={viewState}
              rackDevices={rackDevices}
            />
          )}

          {activeTab === 'changes' && (
            <DatacenterChangeRequestView />
          )}

          {activeTab === 'security' && (
            <SecurityCenterView
              loginLogs={loginLogs}
              auditLogs={auditLogs}
              blocklist={blocklist}
              onOpenBlockModal={() => setIsBlockModalOpen(true)}
              onUnblock={handleUnblockIP}
            />
          )}

          {activeTab === 'resident' && (
            <ResidentManagementView residentStaff={residentStaff} onRefresh={refreshData} />
          )}

          {activeTab === 'backup' && (
            <BackupView
              backups={backups}
              summary={backupSummary}
              onManualBackup={handleManualBackup}
              onDownloadBackup={handleDownloadBackup}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementView
              users={users}
              roleDefinitions={ROLE_DEFINITIONS}
              currentUsername={currentUserInfo?.username}
              onCreateUser={handleOpenCreateUser}
              onOpenEdit={handleOpenEditUser}
              onOpenReset={(user) => {
                setResetTarget({ ...user, must_change_password: true });
                setIsResetModalOpen(true);
              }}
              onToggleActive={handleToggleUserActive}
              onUnlock={handleUnlockUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </div>
      </main>

      {/* Shared management modals */}
      {managingOptionKey && <OptionManagerModal title={managingOptionKey} options={optionLists[managingOptionKey]} onClose={()=>setManagingOptionKey(null)} onSave={(l)=>setOptionLists({...optionLists, [managingOptionKey]: l})} />}
      <NetworkManagementModals
        isSectionModalOpen={isSectionModalOpen}
        setIsSectionModalOpen={setIsSectionModalOpen}
        sectionFormData={sectionFormData}
        setSectionFormData={setSectionFormData}
        handleSaveSection={handleSaveSection}
        isSubnetModalOpen={isSubnetModalOpen}
        setIsSubnetModalOpen={setIsSubnetModalOpen}
        subnetFormData={subnetFormData}
        setSubnetFormData={setSubnetFormData}
        optionLists={optionLists}
        openOptionManager={openOptionManager}
        handleSaveSubnet={handleSaveSubnet}
        isIPModalOpen={isIPModalOpen}
        setIsIPModalOpen={setIsIPModalOpen}
        ipFormData={ipFormData}
        setIpFormData={setIpFormData}
        historyOptions={historyOptions}
        handleSaveIP={handleSaveIP}
      />

      {/* Import preview modal */}
      {importWizardOpen && pendingFile && (
        <ImportWizardModal 
          file={pendingFile} 
          context={importContext}
          onClose={closeImportWizard}
          onConfirm={handleConfirmImport}
        />
      )}

      {editingDevice && (
        <DeviceModal
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
          onSave={handleSaveDevice}
          onDelete={handleDeleteDevice}
          optionLists={optionLists}
          openOptionManager={openOptionManager}
          historyOptions={historyOptions}
          deviceStatus={DEVICE_STATUS}
        />
      )}
      {isRackModalOpen && (
        <RackModal
          rack={currentRackForm}
          onClose={() => setIsRackModalOpen(false)}
          onSave={handleSaveRack}
          locations={datacenters}
          initialDatacenter={activeLocation}
        />
      )}
      {isDcModalOpen && (
        <DatacenterModal
          dc={currentDcForm}
          onClose={() => setIsDcModalOpen(false)}
          onSave={handleSaveDatacenter}
        />
      )}

      <AuthManagementModals
        isUserModalOpen={isUserModalOpen}
        setIsUserModalOpen={closeUserModal}
        userModalMode={userModalMode}
        userFormData={userFormData}
        setUserFormData={setUserFormData}
        roleDefinitions={ROLE_DEFINITIONS}
        handleSaveUser={handleSaveUser}
        isResetModalOpen={isResetModalOpen}
        setIsResetModalOpen={setIsResetModalOpen}
        resetTarget={resetTarget}
        setResetTarget={setResetTarget}
        handleResetConfirm={handleResetConfirm}
        isPasswordChangeModalOpen={isPasswordChangeModalOpen}
        setIsPasswordChangeModalOpen={setIsPasswordChangeModalOpen}
        currentUserInfo={currentUserInfo}
        passwordFormData={passwordFormData}
        setPasswordFormData={setPasswordFormData}
        handleChangeOwnPassword={handleChangeOwnPassword}
        isBlockModalOpen={isBlockModalOpen}
        setIsBlockModalOpen={setIsBlockModalOpen}
        blockFormData={blockFormData}
        setBlockFormData={setBlockFormData}
        handleBlockIP={handleBlockIP}
      />
      <SystemStatusModal
        isOpen={isSystemStatusOpen}
        onClose={() => setIsSystemStatusOpen(false)}
        overview={systemOverview}
        backendVersion={backendVersion}
        isLoading={isSystemOverviewLoading}
        onRefresh={refreshOverview}
        lastRefreshedAt={systemOverviewRefreshedAt}
      />
      {/* Global utility overlays */}
      <NotificationCenter items={notifications} onDismiss={dismissNotification} />
      <ConfirmActionModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} tone={confirmState.tone} onCancel={() => closeConfirm(false)} onConfirm={() => closeConfirm(true)} />
      <DebugModal isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} logs={debugLogs} onClear={() => setDebugLogs([])} />
    </div>
  );
}

// ============================================================================
// 6. App Wrapper with Error Boundary
// ============================================================================
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}



