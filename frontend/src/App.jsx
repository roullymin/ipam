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
import { useImportExportHandlers } from './hooks/useImportExportHandlers';
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
  admin: { label: '\u8d85\u7ea7\u7ba1\u7406\u5458', permissions: ['dashboard', 'list', 'dcim', 'resident', 'security', 'backup', 'users'] },
  dc_operator: { label: '\u673a\u623f\u8fd0\u7ef4', permissions: ['dashboard', 'dcim', 'resident'] },
  ip_manager: { label: 'IP \u7ba1\u7406\u5458', permissions: ['dashboard', 'list'] },
  auditor: { label: '\u5ba1\u8ba1\u5458', permissions: ['dashboard', 'security', 'resident'] },
  guest: { label: '\u8bbf\u5ba2', permissions: ['dashboard', 'list', 'dcim'] },
};

const TAB_CONFIG = {
  dashboard: { icon: LayoutDashboard, label: BRAND.navigation.dashboard },
  list: { icon: Server, label: BRAND.navigation.list },
  dcim: { icon: Box, label: BRAND.navigation.dcim },
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

// 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑鏅悷婊冪Ч濠€渚€姊虹紒妯虹伇婵☆偄瀚板鍛婄瑹閳ь剟寮婚悢鍏尖拻閻庨潧澹婂Σ顕€姊虹粙鑳潶闁告柨閰ｉ獮澶愬箹娴ｅ憡顥濋柣鐘充航閸斿秴鈻撴ィ鍐┾拺闁圭娴风粻鎾淬亜閿旇鐏﹂柣娑卞櫍婵偓闁挎稑瀚鏇㈡⒑閻熼偊鍤熼柛搴㈠姍閹偤宕滆閸嬫牗绻濋棃娑卞剱闁抽攱甯掗湁闁挎繂娲ら崝瀣煕閵堝倸浜鹃梻鍌欑椤撲粙寮堕崹顕呯€烽梻浣烘嚀缁犲秹宕硅ぐ鎺濇晣闁稿繒鍘х欢鐐测攽閻樻彃鈧綊宕曢鍫熲拻濞撴埃鍋撴繛浣冲洦鍋嬮柛鈩冾樅濞差亝鍋愰悹鍥皺閿涙盯姊虹憴鍕妞ゆ泦鍥х闁煎摜鍋ｆ禍婊堟煙閻愵剦娈旈柟鍐插閹便劍绺介崨濠勫幗闁瑰吋鐣崺鍕疮韫囨稒鐓曢柣妯虹－濞插鈧娲樺钘夘嚕娴犲鏁囬柣鎰問濡叉潙鈹戦悩鍨毄濠殿喗娼欑叅闁靛牆顦伴悡渚€鏌涢妷顔煎闁绘挻鐩弻娑㈠Ψ閵忊剝鐝旀繛瀵稿閸曗晙绨婚梺鎸庢椤曆勭閻楀牊鍙忓┑鐘叉噺椤忕娀鏌涢弽銊у⒌鐎殿喗鎸抽幃娆徝圭€ｎ偄鐝舵繝纰夌磿閸嬫垿宕愰幋锕€绀夌€光偓閸曨偆鐤囧┑顔姐仜閸嬫挻顨?./components/ImportWizardModal

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
  const [activeTab, setActiveTab] = useState('dashboard'); // 濠电姷鏁告慨鐑藉极閸涘﹥鍙忛柣銏犲閺佸﹪鏌″搴″箹缂佹劖顨嗘穱濠囧Χ閸涱厽娈查梺鍝勬缁秵绌辨繝鍥ч柛娑卞幗濞堝爼姊哄ú璇插箺闁荤啿鏅犲濠氭偄閸忕厧鈧粯淇婇鐐存珳缂侇喖鐖煎娲焻閻愯尪瀚板褍澧界槐鎺楁偐閾忣偄纰嶉梺浼欑秮閺€杈╃紦閻ｅ瞼鐭欓悹鍥﹀嫎閸斿秹濡甸崟顖氱睄闁搞儺鐏濋幘瀵哥闁告侗鍘捐倴缂備浇椴搁幑鍥х暦閹烘埈娼╂い鎴ｆ娴滈箖鏌ｉ幋锝呅撻柛濠傛健閺屻劑寮村鍗炲闂佺懓鍟块懟顖炲煘閹达附鍊烽柤纰卞墯閹插ジ姊洪幖鐐测偓鏇㈡煀閿濆懐鏆﹂柟鐗堟緲閸愨偓濡炪倖鍔х徊鑺ユ償婵犲倵鏀介柣鎰綑閻忕喖鏌涢妸銉﹁础缂侇喖顭烽弫鎰緞鐎ｎ剙骞楅梻濠庡亜濞诧箑顫忚ぐ鎺懳﹂柣鏃囶問閻熼偊鐓ラ柛鏇ㄥ幘閻撳顪冮妶鍐ㄧ仾鐎光偓閹间礁鏋侀柟閭﹀幖缁剁偛鈹戦悩鎻掝伌闁哥偞鎸冲缁樻媴缁嬫寧鍊繛瀛樼矆缁瑥鐣烽弴銏犵闁芥ê顦崑宥夋⒒娓氬洤澧紒澶屾暬钘熷┑鐘插暔娴滄粓鏌熼幍铏珔闁诲浚浜弻鐔煎礂閻撳骸顫嶉梺闈涙搐鐎氫即鐛€ｎ亖鏀介柛銉戝嫷浠繝鐢靛剳缁茶棄煤閵堝鏅濇い蹇撶墕缁犵娀鏌ｉ幇顒佹儓閸烆垶鎮峰鍐妞ゃ垺鐟╁鎾閳锯偓閹锋椽姊洪崨濠勨槈闁挎洩绲垮▎銏ゆ焼瀹ュ棛鍘遍梺缁樏崯鍧楀传閻戞﹩娈介柣鎰嚋闊剛鈧娲橀敃銏ゅ春閻愭潙绶為柛婵勫劤濞夊灝鈹戦敍鍕杭闁稿﹥鐗犲畷婵婎槾缂佽京鍋ゅ畷鍗烆渻缂佹浜栨繝鐢靛Т閿曘倝骞婃径鎰；闁规崘鍩栭崰鍡涙煕閺囥劌澧版い锔哄姂閺岋綁濮€閳轰胶浠柣銏╁灲缁绘繂鐣峰ú顏呭€烽柛婵嗗椤撴椽姊洪幐搴㈢５闁稿鎸剧槐鎺楁偐瀹曞洠濮囬梺闈涙搐鐎氫即鐛Ο鍏煎磯闁烩晜甯囬崕闈浳?
  const [ipViewMode, setIpViewMode] = useState('list');
  const [dcimViewMode, setDcimViewMode] = useState('list');
  const [elevationLayout, setElevationLayout] = useState('horizontal');
  const [debugLogs, setDebugLogs] = useState([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
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

  const [activeLocation, setActiveLocation] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [selectedSubnetId, setSelectedSubnetId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);

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
  const [currentRackForm, setCurrentRackForm] = useState(null);
  const [currentDcForm, setCurrentDcForm] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  const elevationScrollRef = useRef(null);
  const elevationContentRef = useRef(null);
  const elevationDragInfo = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [viewState, setViewState] = useState({ scale: 0.74 });

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
  const handleZoomIn = () => setViewState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.06, 0.9) }));
  const handleZoomOut = () => setViewState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.06, 0.56) }));
  const handleZoomReset = () => setViewState({ scale: 0.74 });

  const getRackCalculatedPower = (rackId) => {
      if (!Array.isArray(rackDevices)) return { rated_sum: 0, typical_sum: 0 };
    const devicesInRack = rackDevices.filter(d => String(d.rack) === String(rackId));
      return devicesInRack.reduce((acc, dev) => ({ rated_sum: acc.rated_sum + (safeInt(dev.power_usage) || 0), typical_sum: acc.typical_sum + (safeInt(dev.typical_power) || 0) }), { rated_sum: 0, typical_sum: 0 });
  };

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

  const currentRacks = useMemo(() => racks.filter(r => String(r.datacenter) === String(activeLocation)), [racks, activeLocation]);
  const currentSubnet = useMemo(() => subnets.find(s => String(s.id) === String(selectedSubnetId)) || {}, [subnets, selectedSubnetId]);
  
  const filteredIPs = useMemo(() => {
    const selectedKey = selectedSubnetId == null ? null : String(selectedSubnetId);
    return ips.filter(ip => {
      const matchSubnet = selectedKey == null ? true : String(ip.subnet) === selectedKey;
      const matchSearch = searchQuery ? JSON.stringify(ip).toLowerCase().includes(searchQuery.toLowerCase()) : true;
      const matchTag = tagFilter ? (ip.tag === tagFilter) : true;
      return matchSubnet && matchSearch && matchTag;
    });
  }, [ips, selectedSubnetId, searchQuery, tagFilter]);

  const uniqueTags = useMemo(() => {
    const tags = new Set();
    ips.forEach(ip => {
      if (ip.tag) tags.add(ip.tag);
    });
    return Array.from(tags);
  }, [ips]);

  const datacenterPowerStats = useMemo(() => {
    return currentRacks.reduce(
      (acc, rack) => {
        const rackStats = getRackCalculatedPower(rack.id);
        return {
          total_rated: acc.total_rated + rackStats.rated_sum,
          total_typical: acc.total_typical + rackStats.typical_sum,
          total_pdu: acc.total_pdu + safeInt(rack.pdu_power, 0),
        };
      },
      { total_rated: 0, total_typical: 0, total_pdu: 0 }
    );
  }, [currentRacks]);

  const handleElevationMouseDown = (e) => {
    const ele = elevationScrollRef.current;
    if (!ele) return;
    elevationDragInfo.current.isDown = true;
    elevationDragInfo.current.startX = e.pageX - ele.offsetLeft;
    elevationDragInfo.current.startY = e.pageY - ele.offsetTop;
    elevationDragInfo.current.scrollLeft = ele.scrollLeft;
    elevationDragInfo.current.scrollTop = ele.scrollTop;
    ele.style.cursor = 'grabbing';
  };

  const handleElevationMouseLeave = () => {
    elevationDragInfo.current.isDown = false;
    if (elevationScrollRef.current) elevationScrollRef.current.style.cursor = 'grab';
  };

  const handleElevationMouseUp = () => {
    elevationDragInfo.current.isDown = false;
    if (elevationScrollRef.current) elevationScrollRef.current.style.cursor = 'grab';
  };

  const handleElevationMouseMove = (e) => {
    if (!elevationDragInfo.current.isDown) return;
    e.preventDefault();
    const ele = elevationScrollRef.current;
    const x = e.pageX - ele.offsetLeft;
    const y = e.pageY - ele.offsetTop;
    const walkX = (x - elevationDragInfo.current.startX) * 1.2;
    const walkY = (y - elevationDragInfo.current.startY) * 1.2;
    ele.scrollLeft = elevationDragInfo.current.scrollLeft - walkX;
    ele.scrollTop = elevationDragInfo.current.scrollTop - walkY;
  };

  const {
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

  const handleJumpToDc = (dcId) => {
    setActiveTab('dcim');
    setActiveLocation(dcId);
  };

  const handleSaveIP = async () => {
    if (!ipFormData.ip_address) {
      alert('IP address is required.');
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
      alert(editingIP ? 'IP record updated.' : 'IP record created.');
      setIsIPModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`Failed to save IP record: ${error.message}`);
    }
  };

  const handleDeleteIP = async (id) => {
    if (!confirm('Delete this IP record?')) return;
    try {
      const response = await safeFetch(`/api/ips/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete IP record'));
      }
      refreshData();
    } catch (error) {
      alert(`Failed to delete IP record: ${error.message}`);
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
      alert('Subnet name is required.');
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
        throw new Error(await extractResponseMessage(response, 'Failed to save subnet'));
      }
      alert(subnetFormData.id ? 'Subnet updated.' : 'Subnet created.');
      setIsSubnetModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`Failed to save subnet: ${error.message}`);
    }
  };

  const handleSaveSection = async () => {
    if (!sectionFormData.name) {
      alert('Section name is required.');
      return;
    }

    try {
      const response = await safeFetch('/api/sections/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionFormData),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to save section'));
      }
      alert('Section created.');
      setIsSectionModalOpen(false);
      setSectionFormData({});
      refreshData();
    } catch (error) {
      alert(`Failed to save section: ${error.message}`);
    }
  };

  const handleDeleteSection = async (id) => {
    if (!confirm('Delete this network section?')) return;
    try {
      const response = await safeFetch(`/api/sections/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete section'));
      }
      refreshData();
    } catch (error) {
      alert(`Failed to delete section: ${error.message}`);
    }
  };

  const handleDeleteSubnet = async (id) => {
    if (!confirm('Delete this subnet?')) return;
    try {
      const response = await safeFetch(`/api/subnets/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete subnet'));
      }
      setSelectedSubnetId(null);
      refreshData();
    } catch (error) {
      alert(`Failed to delete subnet: ${error.message}`);
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
        throw new Error(await extractResponseMessage(response, 'Failed to save datacenter'));
      }
      alert(formData.id ? 'Datacenter updated.' : 'Datacenter created.');
      setIsDcModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`Failed to save datacenter: ${error.message}`);
    }
  };

  const handleDeleteDatacenter = async (id) => {
    if (!confirm('Delete this datacenter?')) return;
    try {
      const response = await safeFetch(`/api/datacenters/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete datacenter'));
      }
      if (activeLocation === id) setActiveLocation(null);
      refreshData();
    } catch (error) {
      alert(`Failed to delete datacenter: ${error.message}`);
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
        throw new Error(await extractResponseMessage(response, 'Failed to save rack'));
      }
      alert(formData.id ? 'Rack updated.' : 'Rack created.');
      setIsRackModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`Failed to save rack: ${error.message}`);
    }
  };

  const handleDeleteRack = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this rack?')) return;
    try {
      const response = await safeFetch(`/api/racks/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete rack'));
      }
      if (selectedRack?.id === id) setSelectedRack(null);
      refreshData();
    } catch (error) {
      alert(`Failed to delete rack: ${error.message}`);
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
        throw new Error(await extractResponseMessage(response, 'Failed to save device'));
      }
      updateHistory(deviceData);
      alert(deviceData.id ? 'Device updated.' : 'Device created.');
      setEditingDevice(null);
      refreshData();
    } catch (error) {
      alert(`Failed to save device: ${error.message}`);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!confirm('Delete this device?')) return;
    try {
      const response = await safeFetch(`/api/rack-devices/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete device'));
      }
      setEditingDevice(null);
      refreshData();
    } catch (error) {
      alert(`Failed to delete device: ${error.message}`);
    }
  };

  const handleScanSubnet = async () => {
    if (!selectedSubnetId) return;
    if (!confirm('Start subnet scan now?')) return;

    setIsScanning(true);
    try {
      const response = await safeFetch('/api/scan/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet_id: selectedSubnetId }),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Subnet scan failed'));
      }
      const data = await response.json();
      alert(data.message || 'Subnet scan completed.');
      refreshData();
    } catch (error) {
      alert(`Subnet scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualBackup = async () => {
    try {
      const response = await safeFetch('/api/trigger-backup/', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Manual backup failed');
      }
      alert(`Backup created: ${data.filename}`);
      refreshData('backup');
    } catch (error) {
      alert(`Manual backup failed: ${error.message}`);
    }
  };

  const handleDownloadBackup = (filename) => {
    window.open(`/api/backup/download/?filename=${encodeURIComponent(filename)}`, '_blank');
  };

  const handleBlockIP = async () => {
    if (!blockFormData.ip_address) {
      alert('IP address is required.');
      return;
    }
    try {
      const response = await safeFetch('/api/blocklist/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockFormData),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to add blocklist entry'));
      }
      alert('Blocklist entry created.');
      setIsBlockModalOpen(false);
      refreshData();
    } catch (error) {
      alert(`Failed to add blocklist entry: ${error.message}`);
    }
  };

  const handleUnblockIP = async (id) => {
    if (!confirm('Remove this blocklist entry?')) return;
    try {
      const response = await safeFetch(`/api/blocklist/${id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to remove blocklist entry'));
      }
      refreshData();
    } catch (error) {
      alert(`Failed to remove blocklist entry: ${error.message}`);
    }
  };

  const handlePoolIPClick = (item) => { 
      if (item.id) {
          setEditingIP(item);
          setIpFormData(item);
      } else {
          setEditingIP(null);
          setIpFormData({ 
              ip_address: item.ip || item.ip_address, 
              status: item.status === 'free' ? 'offline' : item.status 
          });
      }
      setIsIPModalOpen(true); 
  };

  if (isAuthChecking) {
      return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Checking your session...</div>;
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
        />

        <main className="flex-1 flex flex-col min-w-0 bg-transparent">
          <AppHeader
            activeLabel={TAB_CONFIG[activeTab]?.label || BRAND.navigation.dashboard}
            currentUser={currentUserDisplay}
            currentRoleLabel={ROLE_DEFINITIONS[currentRole]?.label}
            onOpenDebug={() => setIsDebugOpen(true)}
            onOpenPasswordChange={() => setIsPasswordChangeModalOpen(true)}
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
                onJumpToDc={handleJumpToDc}
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

      {/* --- 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌ｉ幋锝呅撻柛銈呭閺屾盯顢曢敐鍡欙紩闂侀€炲苯澧剧紒鐘虫尭閻ｉ攱绺界粙娆炬綂闂佺偨鍎遍崯璺ㄨ姳閵夆晜鈷掑ù锝囶焾椤ュ繘鏌涚€ｂ晝绐旂€规洘娲樺蹇涘煛閸愵亞鍔跺┑鐘灱濞夋稒寰勯崶顒€纾婚柟鎹愵嚙缁€鍌氼熆鐠虹尨姊楀瑙勬礋濮婄粯鎷呴崨濠傛殘濠电偠顕滅粻鎾崇暦濠婂啠鏋庨柟鎯х－椤︻參姊洪崨濠傚婵☆垰锕ら妴鎺撶節濮橆厾鍘梺鍓插亝缁诲啴藟濠婂牊鐓曠憸宥夋晝椤忓牆钃熸繛鎴炲焹閸嬫捇鏁愭惔鈥茬凹閻庤娲栭惌鍌炲蓟閻斿吋瀵犲璺鸿嫰閻撶喖姊烘潪鎵妽闁告梹鐗曢銉╁礋椤撴稑浜鹃柨婵嗛婢ь噣鎮介娑辨疁婵﹦绮幏鍛村传閵夛妇鈧喖鈹戦埄鍐︿粻闁告柨娴烽崚鎺楀醇閻旇櫣鎳濋梺閫炲苯澧い鏇秮閹煎綊顢曢妶鍥╂闂備焦鎮堕崕顖炲礉鎼淬劌鍌ㄩ梺顒€绉甸悡鐔煎箹閹碱厼鐏ｇ紒澶屾暬閺屾稓鈧綆浜濋崳钘壝瑰鍐╁暈閻庝絻鍋愰埀顒佺⊕椤洭宕㈤悽鍛婂€甸柣鐔告緲椤忣偄顭胯椤ㄥ﹤鐣烽搹顐ゎ浄閻庯綆鍋嗛崢鍨繆閻愬樊鍎忓Δ鐘虫倐閸┿垽宕奸妷锔惧幈闂佸疇妗ㄧ粈渚€顢旈鐘亾鐟欏嫭绀冮柨鏇樺灲瀹曟椽鏁撻悩鑼紲濠电偞鍨靛畷顒勫疾閻樼粯鈷掗柛灞捐壘閳ь剚鎮傚畷鎰暋閹冲﹤缍婂畷鍫曨敆婢跺娅旈柣鐔哥矊缁夊綊鏁愰悙娴嬫斀閻庯綆鍋呭▍鍥⒑缁嬭法鐒垮┑鈥虫川缁瑨绠涢弮鍌滅槇闂侀潧楠忕徊浠嬫偂閹扮増鐓曢柡鍐ｅ亾闁绘濮撮悾鐑藉即閻愬秵姊归幏鍛村礂閸濄儳娉块梻鍌欑閹碱偊宕愰幖浣瑰€舵繝闈涱儏閻撴洟鏌￠崒姘辨皑婵?(Modals) --- */}
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

      {/* 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾剧懓顪冪€ｎ亝鎹ｉ柣顓炴閵嗘帒顫濋敐鍛婵°倗濮烽崑鐐烘偋閻樻眹鈧線寮撮姀鈩冩珖闂侀€炲苯澧板瑙勬礉閵囨劙骞掗幘璺哄箺闂備胶绮濠氬储瑜庣粋宥嗗鐎涙鍘介梺鍝勫€圭€笛囁夐悙鐑樼厵濞撴艾鐏濇俊鍏笺亜椤忓嫬鏆熼柟椋庡█閻擃偊顢橀悜鍡橆棥闂傚倷娴囧畷鍨叏瀹曞洦濯伴柨鏇炲€搁崹鍌炴煕椤愶絾绀€闁藉啰鍠愮换娑㈠箣濞嗗繒浠肩紓浣哄У閻╊垰顫忔繝姘唶闁绘棁銆€婵洭姊虹拠鑼缂佸鎳撻～蹇撁洪鍕炊闂佸憡娲﹂崜娆擃敁濞戙垺鈷戦柛娑橈攻鐏忔壆鈧厜鍋撻柟闂磋兌瀹撲線鏌涢鐘插姎閹喖姊洪棃娑辨▓闁哥姵顨呴娆徝洪鍛嫼缂備緡鍨卞ú鏍ㄦ櫠閸欏浜滈柕濞垮劜閸ゅ洭鏌涢埡鍌滄创妤犵偞甯掕灃濞达絽寮剁€氬ジ姊绘担渚敯闁稿鍔欏畷鎴濃槈閵忕姷鍔﹀銈嗗笂缁€渚€鎮樼€电硶鍋撶憴鍕闁告梹娲熼崺鐐哄箣閻橆偄浜鹃柨婵嗙凹濞寸兘鏌熼懞銉︾闁宠鍨块幃娆撳级閹寸姳妗撶紓鍌欑贰閸犳牠鏌婇敐澶婄畺闁秆勵殔閻掑灚銇勯幒鎴濐仾闁绘挾鍠栭獮鏍箹椤撶偟浠紓浣割樀濞佳囨箒濠电姴锕ょ€氼噣鎯岀€ｎ喗鐓欏〒姘仢婵′粙鏌熼娑欘棃濠碘剝鎮傞弫鍌滄喆閸曨偒浼栭梻鍌欐祰瀹曞灚鎱ㄩ弶鎳ㄦ椽鎮╃拠鑼姦濡炪倖甯掗崯顖炴偟椤忓牊鐓熼煫鍥ㄦ尵鑲栫紓浣介哺閹歌崵绮悢鐓庣倞鐟滃酣鎮橀崼銉︹拻濞达絿顭堢花鑽ょ磽瀹ュ嫮顦﹂柣锝呭槻鐓ゆい蹇撳閸?Modal */}
      {importWizardOpen && pendingFile && (
        <ImportWizardModal 
          file={pendingFile} 
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
      {/* 闂傚倸鍊搁崐鎼佸磹閹间礁纾圭€瑰嫭鍣磋ぐ鎺戠倞鐟滃繘寮抽敃鍌涚厱妞ゎ厽鍨垫禍婵嬫煕濞嗗繒绠婚柡宀€鍠撶槐鎺楀閻樺磭褰梻浣芥〃缁€浣衡偓姘嵆瀵鈽夊Ο閿嬵潔濠电偛妫欓崝妤冪矙閸ヮ剚鈷戞慨鐟版搐閳ь兙鍊濆畷鎶芥晲婢跺﹨鎽曢梺缁樻⒒閸樠呯不濮樿埖鐓涘璺猴攻濞呭洭鏌熼崜褏甯涢柣鎾存礋楠炴牜鍒掔憴鍕垫綈闂佽　鍋撳┑鐘崇閻撳繘鏌涢妷鎴濆枤娴煎啴鎮楀▓鍨灆缂侇喗鐟╅妴渚€寮撮～顔剧◤濡炪倖鎸炬慨闈涚暦閻旇櫣纾介柛灞捐壘閳ь剟顥撳▎銏ゆ晸閻樿尙锛涢梺鍛婃处閸橀箖鎯岄幘鑸靛枑闁绘鐗嗙粭鎺楁煢閸愵亜鏋涢柡宀嬬節瀹曞爼鍩℃担鍦偓鑽ょ磽娴ｇ顣抽柛瀣ㄥ€濆璇测槈閵忊晜鏅濋梺鎸庣箓濞层劑鎮鹃崹顐ょ瘈婵炲牆鐏濋弸鏃堟煕閵娿劌鍚规俊鍙夊姍楠炴鈧稒锚椤庢捇姊洪崨濠勭畵閻庢艾鎳樻慨鈧柣娆屽亾闁绘柨妫涢幉绋款吋婢跺鍘愰梺鎸庣箓椤︻垶寮伴妷鈺傜厓鐟滄粓宕滃璺何﹂柛鏇ㄥ灠缁犲磭鈧箍鍎卞ú鈺冪玻濡ゅ懏鈷戦柛婵勫劚閺嬪海绱掔紒姗堣€跨€殿喛顕ч埥澶愬閳ュ厖姹楅柣搴ゎ潐濞叉牕煤閵堝鐒荤憸鐗堝笚閳锋垿鏌熺粙鍨劉缁剧偓鎮傞弻娑㈠Ω閵堝洨鐓撻悗娈垮枛椤嘲鐣烽崡鐐嶆梹绻濋崒娑樷偓顖炴⒒娴ｈ櫣銆婇柛鎾寸箞婵＄敻鎮欓棃娑樼亰?*/}
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



