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
import AppScreenRouter from './components/shell/AppScreenRouter';
import AlertCenterModal from './components/shell/AlertCenterModal';
import AppSidebar from './components/AppSidebar';
import AuthManagementModals from './components/AuthManagementModals';
import { DatacenterModal, DeviceModal, RackModal } from './components/DcimManagementModals';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalSearchModal from './components/shell/GlobalSearchModal';
import ImportWizardModal from './components/ImportWizardModal';
import LoginScreen from './components/LoginScreen';
import NetworkManagementModals from './components/NetworkManagementModals';
import SystemStatusModal from './components/SystemStatusModal';
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
import { useImportExportHandlers } from './hooks/useImportExportHandlers';
import { useAppEntryMode } from './hooks/useAppEntryMode';
import { useAppScreenProps } from './hooks/useAppScreenProps';
import { useSystemOverview } from './hooks/useSystemOverview';
import { useUserManagementHandlers } from './hooks/useUserManagementHandlers';
import { DatacenterChangeIntakePage } from './modules/changeRequests';
import { DcimOverviewPage, useDcimDerivedData, useDcimViewState } from './modules/dcim';
import { useIpamDerivedData, useIpamViewActions, useIpamViewState } from './modules/ipam';
import { ResidentIntakePage } from './modules/resident';

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
const ALERT_CENTER_STORAGE_KEY = 'atlasops_alert_center_ignored';
const ALERT_HISTORY_STORAGE_KEY = 'atlasops_alert_center_history';

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
  const {
    isResidentIntakeMode,
    isChangeRequestIntakeMode,
    isDcOverviewMode,
  } = useAppEntryMode();

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
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isAlertCenterOpen, setIsAlertCenterOpen] = useState(false);
  const [residentSearchSeed, setResidentSearchSeed] = useState(null);
  const [changeRequestSearchSeed, setChangeRequestSearchSeed] = useState(null);
  const [ignoredAlertIds, setIgnoredAlertIds] = useState(() => {
    try {
      const saved = localStorage.getItem(ALERT_CENTER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [alertHistory, setAlertHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(ALERT_HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [changeRequestSnapshot, setChangeRequestSnapshot] = useState([]);
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

  useEffect(() => {
    if (!isLoggedIn) {
      setChangeRequestSnapshot([]);
      return;
    }

    let cancelled = false;
    const loadChangeRequests = async () => {
      try {
        const response = await safeFetch('/api/datacenter-change-requests/');
        if (!response.ok) return;
        const payload = await response.json().catch(() => []);
        if (!cancelled) {
          setChangeRequestSnapshot(Array.isArray(payload) ? payload : payload?.results || []);
        }
      } catch {
        if (!cancelled) {
          setChangeRequestSnapshot([]);
        }
      }
    };

    loadChangeRequests();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, activeTab]);

  const globalSearchItems = useMemo(() => {
    const datacenterMap = new Map(datacenters.map((item) => [String(item.id), item]));
    const rackMap = new Map(racks.map((item) => [String(item.id), item]));
    const items = [];

    ips.forEach((ip) => {
      const address = ip.ip_address || ip.address;
      if (!address) return;
      items.push({
        id: `ip-${ip.id || address}`,
        entityType: 'ip',
        title: address,
        subtitle: [ip.device_name || ip.hostname, ip.subnet_cidr || ip.subnet_name, ip.status]
          .filter(Boolean)
          .join(' · '),
        badge: ip.status || 'IP',
        keywords: [
          ip.device_name,
          ip.owner,
          ip.description,
          ip.hostname,
          ip.subnet_cidr,
          ip.subnet_name,
        ].filter(Boolean).join(' '),
        weight: 100,
        target: {
          tab: 'list',
          subnetId: ip.subnet || ip.subnet_id || null,
          query: address,
          openIpId: ip.id || null,
        },
      });
    });

    rackDevices.forEach((device) => {
      const rack = rackMap.get(String(device.rack));
      const datacenter = rack ? datacenterMap.get(String(rack.datacenter)) : null;
      const title = device.name || device.hostname || device.brand || device.model;
      if (!title) return;
      items.push({
        id: `device-${device.id}`,
        entityType: 'device',
        title,
        subtitle: [
          datacenter?.name,
          rack?.name,
          device.management_ip || device.project || device.device_type,
        ].filter(Boolean).join(' · '),
        badge: device.status || '设备',
        keywords: [
          device.asset_tag,
          device.serial_number,
          device.project,
          device.contact,
          device.management_ip,
          device.brand,
          device.model,
        ].filter(Boolean).join(' '),
        weight: 90,
        target: {
          tab: 'dcim',
          datacenterId: rack?.datacenter || null,
          rackId: rack?.id || null,
          openDeviceId: device.id || null,
        },
      });
    });

    racks.forEach((rack) => {
      const datacenter = datacenterMap.get(String(rack.datacenter));
      items.push({
        id: `rack-${rack.id}`,
        entityType: 'rack',
        title: rack.name || rack.code || `机柜 ${rack.id}`,
        subtitle: [
          datacenter?.name || '未分配机房',
          `${safeInt(rack.height, 42)}U`,
          rack.code,
        ].filter(Boolean).join(' · '),
        badge: '机柜',
        keywords: [rack.name, rack.code, rack.description, datacenter?.name].filter(Boolean).join(' '),
        weight: 80,
        target: {
          tab: 'dcim',
          datacenterId: rack.datacenter || null,
          rackId: rack.id,
        },
      });
    });

    residentStaff.forEach((resident) => {
      items.push({
        id: `resident-${resident.id}`,
        entityType: 'resident',
        title: resident.name || `驻场 ${resident.id}`,
        subtitle: [
          resident.company,
          resident.phone || resident.email,
          resident.project_name,
        ].filter(Boolean).join(' · '),
        badge: resident.approval_status || '驻场',
        keywords: [
          resident.company,
          resident.department,
          resident.project_name,
          resident.phone,
          resident.email,
          ...(resident.devices || []).flatMap((device) => [
            device.device_name,
            device.wired_mac,
            device.wireless_mac,
          ]),
        ].filter(Boolean).join(' '),
        weight: 85,
        target: {
          tab: 'resident',
          residentFilters: {
            name: resident.name || '',
            company: resident.company || '',
            phone: resident.phone || '',
            mac: '',
          },
        },
      });
    });

    const projectMap = new Map();
    rackDevices.forEach((device) => {
      const name = String(device.project || '').trim();
      if (!name) return;
      const entry = projectMap.get(name) || { deviceCount: 0, residentCount: 0, datacenterId: null };
      const rack = rackMap.get(String(device.rack));
      entry.deviceCount += 1;
      entry.datacenterId = entry.datacenterId || rack?.datacenter || null;
      projectMap.set(name, entry);
    });
    residentStaff.forEach((resident) => {
      const name = String(resident.project_name || '').trim();
      if (!name) return;
      const entry = projectMap.get(name) || { deviceCount: 0, residentCount: 0, datacenterId: null };
      entry.residentCount += 1;
      projectMap.set(name, entry);
    });
    projectMap.forEach((entry, name) => {
      items.push({
        id: `project-${name}`,
        entityType: 'project',
        title: name,
        subtitle: `设备 ${entry.deviceCount} / 驻场 ${entry.residentCount}`,
        badge: '项目',
        keywords: name,
        weight: 70,
        target: {
          tab: entry.deviceCount ? 'dcim' : 'resident',
          datacenterId: entry.datacenterId,
          residentFilters: entry.residentCount
            ? {
                company: name,
              }
            : null,
        },
      });
    });

    changeRequestSnapshot.forEach((request) => {
      const firstItem = request.items?.[0];
      const typeLabel = request.request_type_label || request.request_type || '设备变更';
      items.push({
        id: `change-request-${request.id}`,
        entityType: 'change-request',
        title: request.title || request.request_code || '设备变更申请',
        subtitle: [
          request.request_code,
          request.applicant_name || request.company,
          firstItem?.device_name || typeLabel,
        ].filter(Boolean).join(' · '),
        badge: request.status_label || request.status || '变更',
        keywords: [
          request.request_code,
          request.title,
          request.applicant_name,
          request.company,
          request.department,
          request.project_name,
          request.reason,
          ...(request.items || []).flatMap((item) => [
            item.device_name,
            item.device_model,
            item.serial_number,
            item.assigned_management_ip,
            item.assigned_service_ip,
          ]),
        ].filter(Boolean).join(' '),
        weight: 95,
        target: {
          tab: 'changes',
          changeRequestId: request.id,
        },
      });
    });

    return items;
  }, [changeRequestSnapshot, datacenters, ips, rackDevices, racks, residentStaff]);

  const alertItems = useMemo(() => {
    const now = Date.now();
    const pendingResidents = residentStaff.filter((item) => item.approval_status === 'pending');
    const seatPendingResidents = residentStaff.filter((item) => item.needs_seat && !item.seat_number);
    const expiringResidents = residentStaff.filter((item) => {
      if (!item.end_date) return false;
      const diff = new Date(item.end_date).getTime() - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    });
    const deviceWarnings = rackDevices.filter(
      (item) => item.status === 'offline' || item.status === 'maintenance'
    );
    const recentFailedLogins = loginLogs.filter((log) => {
      const status = String(log.status || '').toLowerCase();
      if (status === 'success') return false;
      const happenedAt = log.timestamp || log.created_at || log.time;
      if (!happenedAt) return true;
      const diff = now - new Date(happenedAt).getTime();
      return Number.isNaN(diff) ? true : diff <= 24 * 60 * 60 * 1000;
    });
    const alerts = [];

    if (pendingResidents.length) {
      alerts.push({
        id: 'resident-pending',
        level: 'high',
        title: '驻场申请待审批',
        description: `当前有 ${pendingResidents.length} 条驻场申请等待审核或批复。`,
        count: pendingResidents.length,
        actionLabel: '前往驻场工作台处理',
        target: { tab: 'resident' },
      });
    }

    if (seatPendingResidents.length) {
      alerts.push({
        id: 'resident-seat',
        level: 'medium',
        title: '驻场座位尚未安排',
        description: `${seatPendingResidents.length} 名驻场人员需要座位但尚未落实，建议尽快协调办公区域。`,
        count: seatPendingResidents.length,
        actionLabel: '查看座位安排',
        target: { tab: 'resident' },
      });
    }

    if (expiringResidents.length) {
      alerts.push({
        id: 'resident-expiring',
        level: 'medium',
        title: '驻场即将到期',
        description: `${expiringResidents.length} 名驻场人员将在 7 天内到期，需要续期或离场确认。`,
        count: expiringResidents.length,
        actionLabel: '查看到期名单',
        target: { tab: 'resident' },
      });
    }

    if (deviceWarnings.length) {
      alerts.push({
        id: 'dcim-device-warning',
        level: 'high',
        title: '机房设备存在异常状态',
        description: `${deviceWarnings.length} 台设备处于离线或维护状态，建议检查机柜、供电和资产状态。`,
        count: deviceWarnings.length,
        actionLabel: '前往机房设备工作台',
        target: { tab: 'dcim' },
      });
    }

    if ((systemOverview?.data_quality?.suspected_records || 0) > 0) {
      alerts.push({
        id: 'data-quality',
        level: 'medium',
        title: '发现疑似乱码或数据质量问题',
        description: `当前共检测到 ${systemOverview.data_quality.suspected_records} 条疑似异常记录，建议安排清洗。`,
        count: systemOverview.data_quality.suspected_records,
        actionLabel: '查看系统状态',
        target: { openSystemStatus: true },
      });
    }

    if ((systemOverview?.backup?.backup_count || 0) === 0) {
      alerts.push({
        id: 'backup-empty',
        level: 'high',
        title: '尚未生成可用备份',
        description: '系统当前没有备份文件，建议尽快手动执行一次备份并验证可下载性。',
        actionLabel: '前往备份恢复',
        target: { tab: 'backup' },
      });
    } else {
      const latestBackupTime = systemOverview?.backup?.latest_backup_time;
      if (latestBackupTime) {
        const staleHours = (now - new Date(latestBackupTime).getTime()) / (1000 * 60 * 60);
        if (!Number.isNaN(staleHours) && staleHours > 48) {
          alerts.push({
            id: 'backup-stale',
            level: 'medium',
            title: '备份时间偏旧',
            description: `最近一次备份距离现在已超过 ${Math.round(staleHours)} 小时，建议确认备份任务是否正常运行。`,
            actionLabel: '查看备份记录',
            target: { tab: 'backup' },
          });
        }
      }
    }

    if (recentFailedLogins.length) {
      alerts.push({
        id: 'security-login-failures',
        level: 'medium',
        title: '最近存在登录异常',
        description: `最近 24 小时内检测到 ${recentFailedLogins.length} 条失败或异常登录记录。`,
        count: recentFailedLogins.length,
        actionLabel: '前往安全审计',
        target: { tab: 'security' },
      });
    }

    const changeRequestPendingApproval = changeRequestSnapshot.filter((item) => item.status === 'submitted');
    if (changeRequestPendingApproval.length) {
      alerts.push({
        id: 'changes-pending-approval',
        level: 'high',
        title: '设备变更申请待审批',
        description: `当前有 ${changeRequestPendingApproval.length} 条设备变更申请等待审批。`,
        count: changeRequestPendingApproval.length,
        actionLabel: '前往设备变更中心',
        target: { tab: 'changes', changeRequestId: changeRequestPendingApproval[0]?.id || null },
      });
    }

    const changeRequestPendingExecution = changeRequestSnapshot.filter(
      (item) => item.status === 'approved' || item.status === 'scheduled'
    );
    if (changeRequestPendingExecution.length) {
      alerts.push({
        id: 'changes-pending-execution',
        level: 'medium',
        title: '设备变更待执行回填',
        description: `${changeRequestPendingExecution.length} 条设备变更已审批通过，等待执行与回填。`,
        count: changeRequestPendingExecution.length,
        actionLabel: '前往执行回填',
        target: { tab: 'changes', changeRequestId: changeRequestPendingExecution[0]?.id || null },
      });
    }

    const expiredDraftLinks = changeRequestSnapshot.filter((item) => {
      if (!item.token_expires_at) return false;
      if (!['draft', 'submitted'].includes(String(item.status || ''))) return false;
      return new Date(item.token_expires_at).getTime() < now;
    });
    if (expiredDraftLinks.length) {
      alerts.push({
        id: 'changes-expired-links',
        level: 'info',
        title: '设备变更链接已过期',
        description: `${expiredDraftLinks.length} 条设备变更链接已经过期，可能需要重新生成后再发送。`,
        count: expiredDraftLinks.length,
        actionLabel: '查看设备变更链接',
        target: { tab: 'changes', changeRequestId: expiredDraftLinks[0]?.id || null },
      });
    }

    return alerts;
  }, [changeRequestSnapshot, loginLogs, rackDevices, residentStaff, systemOverview]);

  useEffect(() => {
    localStorage.setItem(ALERT_CENTER_STORAGE_KEY, JSON.stringify(ignoredAlertIds));
  }, [ignoredAlertIds]);

  useEffect(() => {
    localStorage.setItem(ALERT_HISTORY_STORAGE_KEY, JSON.stringify(alertHistory));
  }, [alertHistory]);

  const activeAlertItems = useMemo(
    () => alertItems.filter((item) => !ignoredAlertIds.includes(item.id)),
    [alertItems, ignoredAlertIds],
  );

  const ignoredAlertItems = useMemo(
    () => alertItems.filter((item) => ignoredAlertIds.includes(item.id)),
    [alertItems, ignoredAlertIds],
  );

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

  const navigateToShellTarget = React.useCallback((target = {}) => {
    if (target.tab) {
      setActiveTab(target.tab);
    }
    if (target.subnetId) {
      setSelectedSubnetId(target.subnetId);
    }
    if (typeof target.query === 'string') {
      setSearchQuery(target.query);
    }
    if (target.datacenterId) {
      setActiveLocation(target.datacenterId);
    }
    if (target.residentFilters) {
      setResidentSearchSeed({
        ...target.residentFilters,
        _nonce: Date.now(),
      });
    }
    if (target.changeRequestId) {
      setChangeRequestSearchSeed({
        id: target.changeRequestId,
        _nonce: Date.now(),
      });
    }
    if (target.rackId) {
      const matchedRack = racks.find((item) => String(item.id) === String(target.rackId));
      setSelectedRack(matchedRack || null);
    }
    if (target.openDeviceId) {
      const matchedDevice = rackDevices.find((item) => String(item.id) === String(target.openDeviceId));
      if (matchedDevice) {
        setEditingDevice(matchedDevice);
      }
    }
    if (target.openIpId) {
      const matchedIp = ips.find((item) => String(item.id) === String(target.openIpId));
      if (matchedIp) {
        setEditingIP(matchedIp);
        setIpFormData(matchedIp);
        setIsIPModalOpen(true);
      }
    }
    if (target.openSystemStatus) {
      setIsSystemStatusOpen(true);
    }
  }, [ips, rackDevices, racks, setActiveLocation, setEditingDevice, setEditingIP, setIpFormData, setIsIPModalOpen, setSearchQuery, setSelectedRack, setSelectedSubnetId]);

  const pushAlertHistory = React.useCallback((entry) => {
    setAlertHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        occurredAt: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 20));
  }, []);

  const handleGlobalSearchSelect = React.useCallback((item) => {
    navigateToShellTarget(item?.target || {});
    pushAlertHistory({
      type: 'search',
      title: `打开搜索结果：${item?.title || '未命名对象'}`,
      detail: item?.subtitle || item?.entityType || '全局搜索',
    });
    setIsGlobalSearchOpen(false);
  }, [navigateToShellTarget, pushAlertHistory]);

  const handleAlertSelect = React.useCallback((alert) => {
    navigateToShellTarget(alert?.target || {});
    pushAlertHistory({
      type: 'alert-open',
      title: `处理告警：${alert?.title || '未命名告警'}`,
      detail: alert?.description || '',
    });
    setIsAlertCenterOpen(false);
  }, [navigateToShellTarget, pushAlertHistory]);

  const handleIgnoreAlert = React.useCallback((alert) => {
    if (!alert?.id) return;
    setIgnoredAlertIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]));
    pushAlertHistory({
      type: 'alert-ignore',
      title: `已忽略告警：${alert?.title || '未命名告警'}`,
      detail: alert?.description || '',
    });
  }, [pushAlertHistory]);

  const handleRestoreAlert = React.useCallback((alert) => {
    if (!alert?.id) return;
    setIgnoredAlertIds((prev) => prev.filter((item) => item !== alert.id));
    pushAlertHistory({
      type: 'alert-restore',
      title: `已恢复告警：${alert?.title || '未命名告警'}`,
      detail: alert?.description || '',
    });
  }, [pushAlertHistory]);

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

  const screenProps = useAppScreenProps({
    datacenters,
    racks,
    rackDevices,
    ips,
    loginLogs,
    residentStaff,
    residentSearchSeed,
    consumeResidentSearchSeed: () => setResidentSearchSeed(null),
    changeRequestSearchSeed,
    consumeChangeRequestSearchSeed: () => setChangeRequestSearchSeed(null),
    systemOverview,
    systemOverviewRefreshedAt,
    handleJumpToDc,
    setActiveTab,
    sections,
    expandedSections,
    setExpandedSections,
    setSectionFormData,
    setIsSectionModalOpen,
    setSubnetFormData,
    setIsSubnetModalOpen,
    handleDeleteSection,
    subnets,
    selectedSubnetId,
    setSelectedSubnetId,
    handleDeleteSubnet,
    currentSubnet,
    ipViewMode,
    setIpViewMode,
    handleScanSubnet,
    isScanning,
    setIpFormData,
    setEditingIP,
    setIsIPModalOpen,
    searchQuery,
    setSearchQuery,
    tagFilter,
    setTagFilter,
    uniqueTags,
    handleDownloadTemplate,
    handleImportClick,
    isImporting,
    handleExport,
    filteredIPs,
    optionLists,
    handleDeleteIP,
    handlePoolIPClick,
    activeLocation,
    setActiveLocation,
    setCurrentDcForm,
    setIsDcModalOpen,
    handleDeleteDatacenter,
    dcimViewMode,
    setDcimViewMode,
    elevationLayout,
    setElevationLayout,
    handleExportExcel,
    handleExportHtml,
    handleExportImage,
    setCurrentRackForm,
    setIsRackModalOpen,
    datacenterPowerStats,
    currentRacks,
    getRackCalculatedPower,
    selectedRack,
    setSelectedRack,
    handleDeleteRack,
    setEditingDevice,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    elevationScrollRef,
    elevationContentRef,
    handleElevationMouseDown,
    handleElevationMouseLeave,
    handleElevationMouseUp,
    handleElevationMouseMove,
    viewState,
    refreshData,
    auditLogs,
    blocklist,
    setIsBlockModalOpen,
    handleUnblockIP,
    backups,
    backupSummary,
    handleManualBackup,
    handleDownloadBackup,
    users,
    roleDefinitions: ROLE_DEFINITIONS,
    currentUsername: currentUserInfo?.username,
    handleOpenCreateUser,
    handleOpenEditUser,
    setResetTarget,
    setIsResetModalOpen,
    handleToggleUserActive,
    handleUnlockUser,
    handleDeleteUser,
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

  if (isChangeRequestIntakeMode) {
      return <DatacenterChangeIntakePage />;
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
            alertCount={activeAlertItems.length}
            currentUser={currentUserDisplay}
            currentRoleLabel={ROLE_DEFINITIONS[currentRole]?.label}
            onOpenAlerts={() => setIsAlertCenterOpen(true)}
            onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
            onOpenDebug={() => setIsDebugOpen(true)}
            onOpenPasswordChange={() => setIsPasswordChangeModalOpen(true)}
            onOpenSystemStatus={() => setIsSystemStatusOpen(true)}
            overview={systemOverview}
          />

        <div className="flex-1 overflow-hidden relative">
          <AppScreenRouter
            activeTab={activeTab}
            dashboardProps={screenProps.dashboardProps}
            ipamProps={screenProps.ipamProps}
            dcimProps={screenProps.dcimProps}
            residentProps={screenProps.residentProps}
            securityProps={screenProps.securityProps}
            backupProps={screenProps.backupProps}
            usersProps={screenProps.usersProps}
          />
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
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        items={globalSearchItems}
        onSelect={handleGlobalSearchSelect}
      />
      <AlertCenterModal
        isOpen={isAlertCenterOpen}
        onClose={() => setIsAlertCenterOpen(false)}
        alerts={activeAlertItems}
        ignoredAlerts={ignoredAlertItems}
        recentHistory={alertHistory}
        onSelect={handleAlertSelect}
        onIgnore={handleIgnoreAlert}
        onRestore={handleRestoreAlert}
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



