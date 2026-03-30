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
import { DebugModal, FormInput, Modal, OptionManagerModal, SmartInput, StatusBadge } from './components/common/UI';
import { changePasswordRequest, safeFetch } from './lib/api';
import { buildDcimExportPayload, exportDcimHtmlReport, exportDcimImageReport } from './lib/dcimExport';
import { useAuthSession } from './hooks/useAuthSession';

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
  dashboard: { icon: LayoutDashboard, label: '\u5168\u666f\u6982\u89c8' },
  list: { icon: Server, label: 'IP \u8d44\u4ea7\u53f0\u8d26' },
  dcim: { icon: Box, label: '\u673a\u623f\u57fa\u7840\u8bbe\u65bd' },
  resident: { icon: Users, label: '\u9a7b\u573a\u4eba\u5458\u7ba1\u7406' },
  security: { icon: Shield, label: '\u5b89\u5168\u76d1\u63a7\u4e2d\u5fc3' },
  backup: { icon: Database, label: '\u6570\u636e\u5907\u4efd\u6062\u590d' },
  users: { icon: Users, label: '\u7cfb\u7edf\u7528\u6237\u7ba1\u7406' }
};

const HISTORY_TRACKED_FIELDS = [
  'project', 'contact', 'brand', 'model', 'supplier', 'os_version',
  'specs', 'power_usage', 'typical_power', 'purchase_date', 'warranty_date',
  'tag'
];

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

// 闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫰寮告笟鈧弻鐔兼⒒鐎靛壊妲梺绋胯閸斿酣骞夐幖浣告閻犳亽鍔嶅▓楣冩⒑閹稿海绠撴い锔诲灦閻涱噣濮€閿涘嫮顔曢梺鐟邦嚟閸庢劙鎮為崜褎鍋栨繝闈涱儐閳锋帒霉閿濆洤鍔嬮柛銈傚亾闂備礁顓介弶鍨瀷闂佺懓绠嶉崹褰掝敇閸忕厧绶炲┑鐘插€归崕顏堟⒒娓氣偓濞佳囨偋閸℃娲偐鐠囪尙锛涢梺瑙勫礃椤曆囧箲閼哥偣浜滈柟鐐殔閹冲孩鎱ㄦ總鍛婄厽閹兼番鍩勯崯蹇涙煕閻樺磭娲寸€规洘妞藉浠嬵敇閻愭妲村┑鐘垫暩婵潙煤閵堝鐓侀柛銉墯閻撴盯鏌涢妷銏℃珔濞寸姍鍕╀簻闁挎棁顕ф禍鐗堟叏婵犲懏顏犻柛鏍ㄧ墵瀵挳鎮欏ù瀣珶濠碉紕鍋戦崐鎴﹀礉瀹€鍕疇婵せ鍋撴?./components/ImportWizardModal

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
  const [activeTab, setActiveTab] = useState('dashboard'); // 婵犵數濮烽弫鍛婃叏閻㈠壊鏁婇柡宥庡幖缁愭淇婇妶鍛殲闁哄棙绮嶆穱濠囧Χ閸涱厽娈堕梺娲诲幗閻熲晠寮婚悢鍏煎€绘俊顖炴櫜缁爼姊洪柅鐐茶嫰婢у墽绱掗悩铏碍闁伙綁鏀辩缓鐣岀矙鐠囦勘鍔嶉妵鍕籍閸ヮ灝鎾寸箾閸涱厾肖缂佽鲸鎹囧畷鎺戭潩椤戣棄浜鹃柣鎴ｅГ閸婂潡鏌ㄩ弴姘卞妽闁瑰啿鑻埞鎴︽倷閼碱剚鎲奸梺鎼炲€曢柊锝呯暦閹版澘鍐€妞ゆ劧绲芥惔濠傗攽閻愭潙鐏熼柛銊ユ贡缁鏁愭径瀣幗闂婎偄娲﹀褰掑Φ閻旇鐟邦煥閸曨厾鐓夊銈冨灪瀹€鎼佸极閹邦厼绶炲┑鐘插閸炴挳姊绘担绋挎倯濞存粈绮欏畷鏇㈠箮閽樺鍋嶉梻渚囧墮缁夌敻藟婵犲啨浜滈柟鎵虫櫅閻忣亪鏌熼崗鐓庡闁靛洤瀚伴獮瀣攽閸パ勵仭濠电儑绲藉ú銈夋晝椤忓牆绠犻柣鎰惈鍞悷婊冪箻椤㈡瑩寮撮姀鈾€鎷洪梺鍛婄☉閿曪絿娆㈤柆宥嗙厱闁绘ê鍟块崫鐑橆殽閻愯韬€规洘锕㈤崺鐐村緞閸濄儳娉垮┑锛勫亼閸婃牠宕濊缁辩偤宕卞缁樼亖濠电姴锕ら幊澶愬磻閹捐埖鍠嗛柛鏇ㄥ墰椤︺劑鏌ｉ姀鈺佺仭閻㈩垽绻濆畷娲倷閸濆嫮顓洪梺鎸庢磵閸嬫挾绱掗悩宕団姇闁靛洤瀚伴獮妯兼崉閻╂帇鍎靛Λ?
  const [ipViewMode, setIpViewMode] = useState('list');
  const [dcimViewMode, setDcimViewMode] = useState('list');
  const [elevationLayout, setElevationLayout] = useState('horizontal');
  const fileInputRef = useRef(null);

  const [isImporting, setIsImporting] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [importContext, setImportContext] = useState('ipam');
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
};
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
              initialHistory[key] = parsed[key] || [];
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
              const newList = [strItem, ...(list || []).filter(i => String(i) !== strItem)].slice(0, 3);
              return newList;
          };
          HISTORY_TRACKED_FIELDS.forEach(key => {
             if(formData[key]) newHistory[key] = updateList(prev[key], formData[key]);
          });
          localStorage.setItem('app_history_options', JSON.stringify(newHistory));
          return newHistory;
      });
  };

  const [sections, setSections] = useState([]);
  const [subnets, setSubnets] = useState([]);
  const [ips, setIps] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backupSummary, setBackupSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [residentStaff, setResidentStaff] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [datacenters, setDatacenters] = useState([]);
  const [racks, setRacks] = useState([]);
  const [rackDevices, setRackDevices] = useState([]);

  const [activeLocation, setActiveLocation] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [selectedSubnetId, setSelectedSubnetId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

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
      if (/(閹存劕濮泑鐎瑰本鍨殀瀹歌弓绻氱€涙瀹稿弶娲块弬鐨樺鎻掑灩闂勵槩瀹告彃顕遍崗顨傚鎻掝嚤閸戠皸瀹歌尙鏁撻幋?/.test(text)) resolvedType = 'success';
      else if (/(婢惰精瑙闁挎瑨顕瀵倸鐖秥閺冪姵纭秥閺堫亝澹橀崚鐨橀崘鑼崐)/.test(text)) resolvedType = 'error';
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
  const handleZoomOut = () => setViewState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.06, 0.56) }));
  const handleZoomReset = () => setViewState({ scale: 0.74 });

  const getRackCalculatedPower = (rackId) => {
      if (!Array.isArray(rackDevices)) return { rated_sum: 0, typical_sum: 0 };
    const devicesInRack = rackDevices.filter(d => String(d.rack) === String(rackId));
      return devicesInRack.reduce((acc, dev) => ({ rated_sum: acc.rated_sum + (safeInt(dev.power_usage) || 0), typical_sum: acc.typical_sum + (safeInt(dev.typical_power) || 0) }), { rated_sum: 0, typical_sum: 0 });
  };

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
      return currentRacks.reduce((acc, rack) => {
          const rackStats = getRackCalculatedPower(rack.id);
          return { 
              total_rated: acc.total_rated + rackStats.rated_sum, 
              total_typical: acc.total_typical + rackStats.typical_sum, 
              // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋為悧鐘汇€侀弴銏犖ч柛銉㈡櫇閸樼娀姊绘担绋款棌闁稿鎳庣叅鐎广儱顦悞鍨亜閹烘埊鍔熼柣锝囨暩閳ь剝顫夊ú鏍Χ閸涘﹥鍙忛柍褜鍓熼弻鏇＄疀鐎ｎ亞浠煎銈忚吂閺呯姴顫忕紒妯诲闁惧繒鎳撶粭锟犳⒑閸涘﹥顥栫紒鐘虫尭閻ｅ嘲顭ㄩ崘锝嗩潔闂侀潧绻掓慨鐑藉储閹绢喗鍊垫鐐茬仢閸旀碍淇婇銏狀劉缂佸倸绉撮…銊╁醇閻斿搫骞愰梻浣告啞閸旀垿宕濆澶婄闁归偊鍠楅崑鏍ㄦ叏濡灝鐓愰柍閿嬪灴閺屾稑鈹戦崱妤婁痪闂佹寧绋戠粔褰掑蓟濞戞ǚ鏋庨煫鍥ㄦ尰濞堝鎮楀▓鍨灈妞ゎ參鏀辨穱濠囧箹娴ｈ倽銊╂煏韫囧﹥顫婃繛鍏兼⒐缁绘繈鎮介棃娑楃捕濠碘槅鍋呴悷鈺佺暦濞差亜閱囬柕澶堝劜鏉堝牓姊虹捄銊ユ灁濠殿喚鏁婚崺娑㈠箣閻愮數顔曢梺鐓庛偢椤ゅ倿宕搹鍦＜闁靛鍔岄崥鍦磼鏉堛劍灏い鎾炽偢瀹曨亪宕橀鐐村創闂傚倷鑳剁划顖涚瑹濡ゅ懎闂柨婵嗩槸閺勩儵鏌?PDU 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑鏅悷婊冮叄閵嗗啴濡疯閻瑩鏌涢弻顓滃€愰崑鎾诲锤濡や讲鎷哄銈嗗坊閸嬫挾绱掓径濠庡殶濠㈣娲樼换婵嗩潩椤撶姴甯鹃梻浣稿閸嬪懐鎹㈤崘鈺佸灁濠靛倸鎲￠悡鐔煎箹濞ｎ剙鈧洟鎮￠幇鐗堢厪闁搞儜鍐句純閻庢鍠曠划娆撱€侀弴顫稏妞ゆ挾濮靛畷鐔虹磽閸屾艾鈧鎷嬮弻銉ョ；闁圭偓鍓氶悢鍡涙煠閹间焦娑у┑顔肩墦閺岋綁骞樼捄鐑樼亪闂佸搫鐭夌换婵嗙暦閹烘垟妲堟慨妤€妫楀▓婵嬫⒒娴ｇ瓔鍤冮柛銊ゅ嵆閹囧箻鐠囪尪鎽?
              total_pdu: acc.total_pdu + safeInt(rack.pdu_power, 0)
          };
      }, { total_rated: 0, total_typical: 0, total_pdu: 0 });
  }, [currentRacks, rackDevices]);

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

  const handleExport = () => { window.open('/api/export-excel/', '_blank'); };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (importContext === 'dcim') {
      setIsImporting(true);
      const fd = new FormData();
      fd.append('file', f);
      try {
        const res = await safeFetch('/api/dcim/import-excel/', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          alert(data.message || '\u0044\u0043\u0049\u004d \u8d44\u4ea7\u5bfc\u5165\u5b8c\u6210\u3002');
          refreshData();
        } else {
          const errText = await res.text();
          alert('\u0044\u0043\u0049\u004d \u8d44\u4ea7\u5bfc\u5165\u5931\u8d25\uff1a' + errText);
        }
      } catch (err) {
        alert('\u0044\u0043\u0049\u004d \u8d44\u4ea7\u5bfc\u5165\u5f02\u5e38\uff1a' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = null;
      }
      return;
    }
    setPendingFile(f);
    setImportWizardOpen(true);
    e.target.value = null; 
  };

  const handleConfirmImport = async (config) => {
    if (!pendingFile) return;
    setIsImporting(true);
    setImportWizardOpen(false); 
    
    const fd = new FormData();
    fd.append('file', pendingFile);
    fd.append('config', JSON.stringify(config));

    try {
      const res = await safeFetch('/api/import-excel/', { method: 'POST', body: fd });
      if (res.ok) { 
          alert("闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫰寮告笟鈧弻鐔兼⒒鐎靛壊妲梺绋胯閸斿酣骞夐幖浣告閻犳亽鍔嶅▓楣冩⒑閹稿海绠撴い锔诲灦閻涱噣濮€閿涘嫮顔曢梺鐟邦嚟閸庢劙鎮為懞銉ｄ簻闁规儳鐡ㄩ妵婵囨叏婵犲洨绱伴柕鍥ㄥ姍楠炴帡骞嬪鍐╃€抽梻鍌欑閹诧繝骞愭繝姘仭闁冲搫鎳忛弲?); 
          refreshData(); 
      } else { 
          const errText = await res.text();
          try {
            const errJson = JSON.parse(errText);
            alert(`闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫰寮告笟鈧弻鐔兼⒒鐎靛壊妲梺绋胯閸斿酣骞夐幖浣告閻犳亽鍔嶅▓楣冩⒑閹稿海绠撴い锔诲灦閻涱噣濮€閳ヨ尙绠氬銈嗙墬缁诲啴顢旈悩鐢电＜闁归偊鍠栨禒閬嶆煛鐏炵澧茬€垫澘瀚换婵嬪礋椤愮喐瀚涢梻鍌欒兌椤牓顢栭崨姝ゅ洭骞庨柧? ${errJson.message || errText}`);
          } catch(e) {
            alert(`闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫰寮告笟鈧弻鐔兼⒒鐎靛壊妲梺绋胯閸斿酣骞夐幖浣告閻犳亽鍔嶅▓楣冩⒑閹稿海绠撴い锔诲灦閻涱噣濮€閳ヨ尙绠氬銈嗙墬缁诲啴顢旈悩鐢电＜闁归偊鍠栨禒閬嶆煛鐏炵澧茬€垫澘瀚换婵嬪礋椤愮喐瀚涢梻鍌欒兌椤牓顢栭崨姝ゅ洭骞庨柧? ${errText}`); 
          }
      }
    } catch(err) { 
        alert('缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮闁汇値鍠楅妵鍕冀椤愵澀绮堕梺鎼炲妼閸婂潡寮诲☉銏℃櫆閻犲洦褰冪粻褰掓⒑閹肩偛濡界紒璇茬墦瀵鈽夐姀鐘殿啋闂佽偐鈷堥崜娆愪繆娴犲鐓熼幖娣灮椤ｈ尙鈧厜鍋撶紒瀣儥濞兼牗绻涘顔荤盎闁搞劌鍊归妵鍕即閻愭潙娅ｉ梺鍛婃尭閸熷潡鍩為幋锔藉亹妞ゆ劦婢€婢规洟姊绘担鍛婃儓妞わ缚鍗冲畷娲醇閵夛箑浜滈梺绯曞墲缁嬫帡鎮″▎鎰╀簻闁哄秲鍔庨埥澶嬨亜閵夈儺鍎戠紒杈ㄥ浮婵℃悂濡烽敃鈧禒鎾⒑? ' + err.message); 
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
    if (context === 'dcim') {
      window.open('/api/dcim/download-template/', '_blank');
      return;
    }
    window.open('/api/download-template/', '_blank');
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
      alert(`闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫰寮告笟鈧弻鐔兼⒒鐎靛壊妲梺绋胯閸斿酣骞夐幖浣告閻犳亽鍔嶅▓?HTML 濠电姷鏁告慨鐑藉极閸涘﹥鍙忓ù鍏兼綑閸ㄥ倹绻涘顔荤盎缁炬儳娼￠弻銈吤圭€ｎ偅鐝旈梺鎼炲妽缁诲牓寮诲☉銏犵婵°倐鍋撻悗姘煎墴瀵悂宕掗悙绮规嫼闂佸湱顭堢€涒晝绮堥埀顒勬⒑缁嬪尅宸ョ紓宥咃工椤?{error.message}`);
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
      alert(`闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫰寮告笟鈧弻鐔兼⒒鐎靛壊妲梺绋胯閸斿酣骞夐幖浣告閻犳亽鍔嶅▓楣冩⒑濮瑰洤鐏╁鐟帮躬瀵偊宕堕浣哄帾闂婎偄娲﹀ú鏍ф毄闂備胶顭堥敃锕傚磻閵堝拋娼栨繛宸簻瀹告繂鈹戦悩鎻掓殭闁伙妇鍏樺娲川婵犲倸顫庨梺绋款儐閹告瓕顣鹃梺鍓插亝缁洪箖寮ㄦ禒瀣厽婵妫楅弸娑㈡煟韫囷絼閭柡灞剧⊕閹棃濡堕崨顒佺潖闂備礁鎲＄敮妤冩暜閳ュ磭鏆︽繝濠傛－濡插ジ姊洪崫銉バ㈡俊顐ｇ箞瀵濡搁埡浣稿祮闂佺粯鍔栫粊鎾磻閹惧箍浜归柟鐑樺灩閺?{error.message}`);
    }
  };

  const refreshData = async () => {
    setIsDataLoading(true);
    try {
      const [resSec, resSub, resIp, resUser, resResident, resBk, resBkSummary, resLog, resAudit, resBlock, resDc, resRack, resDev] = await Promise.all([
        safeFetch('/api/sections/'), safeFetch('/api/subnets/'), safeFetch('/api/ips/'), safeFetch('/api/users/'),
        safeFetch('/api/resident-staff/'),
        safeFetch('/api/list-backups/'), safeFetch('/api/backup/summary/'), safeFetch('/api/logs/'), safeFetch('/api/audit-logs/'), safeFetch('/api/blocklist/'),
        safeFetch('/api/datacenters/'), safeFetch('/api/racks/'), safeFetch('/api/rack-devices/')
      ]);
      if(resSec.ok) setSections(await resSec.json() || []);
      if(resSub.ok) { const d=await resSub.json() || []; setSubnets(d); if(!selectedSubnetId && d.length>0) setSelectedSubnetId(d[0].id); }
      if(resIp.ok) {
          const rawIps = await resIp.json() || [];
          
          // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗ù锝夋交閼板潡寮堕崼姘珔闁搞劍绻冮妵鍕冀椤愵澀绮剁紓浣插亾濠㈣埖鍔栭悡娑㈡煕閵堝懐鍩ｆい锝忕畱鏁堟俊銈呮噺閳锋垿鏌熼懖鈺佷粶闁告梹鎸抽弻娑㈠箻鐎靛憡鍣伴悗瑙勬礃閿曘垽宕洪埀顒併亜閹烘垵顏柍閿嬪灴閺岀喖鎳栭埡浣风捕闂佸憡姊归〃濠囧蓟閿熺姴宸濇い蹇撴噺閻濇岸鎮楃憴鍕缂佽鐗撻妴浣割潩鐠鸿櫣鍔﹀銈嗗笒鐎氼剟鎷戦悢鍝ョ闁瑰鍎戞笟娑㈡煟閹惧崬鍔﹂柡灞剧洴楠炲洭宕楅崫銉︽櫦闂備礁鎲″Λ蹇涘垂鐠轰警娼栭柧蹇氼潐閸嬫﹢鏌嶉妷銉ュ笭濠㈣娲熷缁樻媴閻熼偊鍤嬬紓浣筋嚙閸婂摜鍙呴梺缁橆焾椤曆呭婵犳碍鐓欓柟瑙勫姇閻撴劙鏌涢悩鍙夘棦闁哄本鐩鎾Ω閵夈儳顔掗梻浣告啞閻燂妇鎹㈤崟顓燁潟闁规儳鐡ㄦ刊鎾煣韫囨洘鍤€缂佹绻濋幃妤呭礂婢跺﹣澹曢梻浣哥秺濡潡鎳楃捄铏规殼濞撴埃鍋撴鐐寸墪鑿愭い鎺嗗亾濠碘€炽偢瀹曞爼骞橀瑙ｆ嫼缂備緡鍨卞ú鏍ㄦ櫠閺屻儲鐓熼柣鏃€娼欓崝锕傛煙椤旀枻鑰块柡灞芥椤撳ジ宕卞▎蹇撶?          const tagRegex = /__TAG__:(.*)$/m; 
          const lockRegex = /__LOCKED__:(true|false)/m;
          
          const processedIps = rawIps.map(ip => {
              let tag = ip.tag || ''; 
              let desc = ip.description || '';
              let is_locked = false;

              // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗霉閿濆浜ら柤鏉挎健瀵爼宕煎顓熺彅闂佹悶鍔嶇换鍐Φ閸曨垰鍐€妞ゆ劦婢€缁墎绱撴担鎻掍壕婵犮垼鍩栭崝鏍偂濞戙垺鐓曢柕鍫濇噽閸╋絾銇勯敐蹇曠暠閺佸牊淇婇妶鍛櫤闁抽攱鍨块弻鐔兼嚃閳轰椒绮堕梺鍛婃⒐閹告娊寮诲☉銏犵闁哄鍨甸幗鐢告⒑鐠団€虫珯缂佺粯绻冩穱濠囨倻閽樺）銊╂煕閹扳晛濡跨紒澶嬫そ閺屸剝鎷呴悷鏉款潚閻庤娲忛崝鎴︺€佸▎鎾村癄濠㈣泛顑囬埀顒勭畺濮婂宕掑▎鎴М闂佸湱鈷堥崑鍕亱闂佸搫鍟悧鍡欐兜閳ь剟姊虹憴鍕姸婵☆偄瀚伴幏鎴︽偄閸忚偐鍘撻梺闈涱檧缁犳垶鏅堕鐐寸厱婵﹩鍓﹂崕鏃堟煛鐏炲墽鈽夐柍钘夘樀瀹曪繝鎮欑€甸晲澹曢梻鍌欑閻ゅ洭锝炴径宀€鐭欓柟杈捐吂閳?
              const lockMatch = desc.match(lockRegex);
              if (lockMatch) {
                  is_locked = lockMatch[1] === 'true';
                  desc = desc.replace(lockRegex, '').trim();
              }

              // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗霉閿濆浜ら柤鏉挎健瀵爼宕煎顓熺彅闂佹悶鍔嶇换鍐Φ閸曨垰鍐€妞ゆ劦婢€缁墎绱撴担鎻掍壕婵犮垼鍩栭崝鏍偂濞戙垺鐓曢柕鍫濇噽閸╋絾銇勯敐蹇曠暠閺佸牊淇婇妶鍛櫤闁抽攱鍨块弻鐔兼嚃閳轰椒绮堕梺鍛婃⒐閹告娊寮诲☉銏犵閻庨潧鎲￠崳浼存倵鐟欏嫭绀冮柨鏇樺灲瀹曟椽鍩€椤掍降浜滈柟鐑樺灥椤忣亪鏌嶉柨瀣伌闁哄瞼鍠栭幊鏍煛娴ｉ鎹曢梻浣告啞濮婂綊銆冩繝鍥ц摕闁跨喓濮村婵囥亜韫囨挻鍣洪柣婵囧哺閹鎲撮崟顒傤槰缂備浇顕ч悧鎾诲Υ娴ｅ壊娼╅悹楦挎閸旓箑顪冮妶鍡楃瑨閻庢凹鍓熼幏鎴︽偄閸忚偐鍘撻梺闈涱檧缁犳垶鏅堕鐐寸厱婵﹩鍓﹂崕鏃堟煛鐏炲墽鈽夐柍钘夘樀瀹曪繝鎮欑€甸晲澹曢梻鍌欑閻ゅ洭锝炴径宀€鐭欓柟杈捐吂閳?
              const tagMatch = desc.match(tagRegex);
              if (tagMatch) {
                  tag = tagMatch[1]; 
                  desc = desc.replace(tagRegex, '').trim();
              }
              
              // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕婵犵绻濆褑鐏掗梺鍏肩ゴ閺呮繈鎮為崗鑲╃闁圭偓娼欓悞褰掓煕鐎ｎ偅宕岄柡宀€鍠栭、娆撳箚瑜屾竟鏇㈡⒑闂堟稓澧崇紓宥勭閻ｅ嘲顫滈埀顒佷繆閹间焦鏅濋柍褜鍓涚划濠囧醇閺囩啿鎷绘繛杈剧到閹诧繝骞嗛崼鐔翠簻闁挎棁妫勯ˉ瀣煃瑜滈崜娑㈡偡閹惰棄宸濇い鎾跺Х閻℃﹢姊绘担鍝勫付妞ゎ偅娲熷畷鎰旈崘顭戞闂佽姤锚椤ャ垼銇愰幒鎾存珳闂佸憡渚楅崰妤呭磿閹剧粯鈷戦柛婵嗗閸庡繒绱掓径濠傤暢婵″弶鍔欓獮鎺懳旈埀顒傜尵瀹ュ鐓冪憸婊堝礈閻旇偐宓侀柟鐗堟緲缁€鍐偓鐟板閸犳牕鈻撻妸锔剧闁哄鍨甸幃鎴炵箾閸忚偐鎳呯紒顔肩墦瀹曞ジ濮€閳ヨ櫕鐎鹃梺璇插嚱缂嶅棝宕戦崱娑栤偓鍛存煥鐎ｎ剛顔曢梺鐟邦嚟閸婃垵顫濋鈺嬬秮瀹曞ジ濡烽敂鎯у箥闂備胶顢婇～澶愬礉閺嶎厽鍋熸い蹇撶墛閻撴瑦銇勯弽銊︾殤濠⒀勭〒缁辨帞绱掑Ο鑲╃杽闂佺硶鏂侀崑鎾愁渻閵堝棗绗掗悗姘卞厴瀵偊宕掗悙瀵稿幈闂佹枼鏅涢崯浼村箠閸曨垱鐓ユ繛鎴烆焽缁犵粯鎱ㄦ繝鍐┿仢鐎规洏鍔嶇换婵嬪礋椤愵偅顥夌紓鍌氬€峰ù鍥ㄣ仈缁嬫５鍝勵煥閸涱厼鐏婇梺鍓插亞閸犲海娆㈤悙鐑樼厵闂侇叏绠戦獮鎰版煙瀹勭増鎯堟い顏勫暣婵″爼宕卞Δ鈧鎴︽⒑缁嬫鍎愰柟鐟版喘瀵鏁愰崼銏㈡澑闂佸搫鍟崐濠氭偪閸曨垱鍊甸悷娆忓绾炬悂鏌涢妸銊バ撳ǎ鍥э躬閹虫粓妫冨☉姘辩嵁濠电姷鏁告慨瀵糕偓姘卞厴瀹曘儳鈧綆鍋傜换鍡涙煟閹板吀绨婚柍褜鍓氶悧鐘茬暦濠靛妲鹃悗鍨緲閿曨亪骞婇悙鍝勎ㄩ柕澶樺枛濞堝ジ姊虹涵鍛棈闁规椿浜炲濠勬崉閵娿儺妫滈梺鑺ッˉ銏ｃ亹閹烘挻娅滈梺鍓插亽閸嬪懐绱為崼銉︾厽闊洦鎸剧粻锝夋煕濡や礁鈻曠€殿喖顭烽弫鎰板醇閵忋垺婢戦梻浣烘嚀閻忔繈宕鐐茬厺闁割偅鎯婇弮鍫熷亹闂傚牊绋愮划鍫曟煟鎼淬垻鈻撻柡鍛箞楠炴垿濮€閻橆偅鏂€闁诲函缍嗘禍鐐烘晬濠婂啠鏀介柣妯款嚋瀹搞儵鎮楀鐓庡籍闁诡喗瀵х粭鐔煎焵椤掆偓椤繒绱掑Ο璇差€撻梺鍛婄☉閿曘儵宕曢幘鍓佺＝濞达絽澹婂Σ瑙勭箾閸忚偐鎳呴柛娆忔嚇濮婃椽骞愭惔銏㈩槬闂佺锕ラ幃鍌氱暦瑜版帒纾兼繛鎴炵懃瀵灝鈹戦埥鍡楃仩闁靛洦锕㈠畷銉╊敃閿旂晫鍘藉銈嗘尵閸犳捇銆傞懠顒傜＜缂備焦顭囬埥澶嬨亜閺傝法绠绘い銏＄懇閹筹繝濡堕崨顓熺槗闂?              let displayStatus = ip.status;
              if (is_locked) {
                  displayStatus = 'online';
              }

              return { ...ip, description: desc, tag: tag, is_locked: is_locked, status: displayStatus };
          });
          setIps(processedIps);
      }
      if(resUser.ok) setUsers(await resUser.json() || []);
      if(resResident.ok) setResidentStaff(await resResident.json() || []);
      if(resBk.ok) setBackups(await resBk.json() || []);
      if(resBkSummary.ok) setBackupSummary(await resBkSummary.json() || null);
      if(resLog.ok) setLoginLogs(await resLog.json() || []);
      if(resAudit.ok) setAuditLogs(await resAudit.json() || []);
      if(resBlock.ok) setBlocklist(await resBlock.json() || []);
      if(resDc.ok) { const d=await resDc.json() || []; setDatacenters(d); if(!activeLocation && d.length>0) setActiveLocation(d[0].id); }
      if(resRack.ok) { 
          const rawRacks = await resRack.json() || [];
          const pduMetaRegex = /__PDU_META__:({.*})$/m;
          const processedRacks = rawRacks.map(r => {
              let desc = r.description || '';
              let pdu_count = 2; 
              let pdu_power = 0; 
              
              const match = desc.match(pduMetaRegex);
              if (match) {
                  try {
                      const meta = JSON.parse(match[1]);
                      pdu_count = safeInt(meta.count, 2);
                      pdu_power = safeInt(meta.power, 0);
                  } catch (e) {}
                  desc = desc.replace(pduMetaRegex, '').trim();
              }
              return {
                  ...r,
                  description: desc,
                  pdu_count: pdu_count,
                  pdu_power: pdu_power
              };
          });
          addDebugLog('闂傚倸鍊搁崐鎼佸磹閹间礁纾圭€瑰嫭鍣磋ぐ鎺戠倞妞ゆ帒锕︾粙蹇旂節閵忥絾纭炬い鎴濇喘閵嗗懘骞撻幑妤€缍婇幃鈺侇啅椤旂厧澹堢紓浣哄亾閸庡啿顭囬敓鐘茶摕闁挎稑瀚▽顏堟偣閸ャ劌绲诲┑顔奸叄濮婃椽宕崟闈涘壆闂佺厧鍟块悥濂哥嵁婢舵劕绠瑰ù锝囨嚀娴滈亶姊洪崜鎻掍簼缂佽瀚伴幃鐑藉Ω瑜忕壕钘壝归敐鍡楃祷濞存粓绠栧铏瑰寲閺囩偛鈷夌紓浣割儐鐢繝骞冮垾鏂ユ婵妫涢崬鐢告煟閻樼儤銆冮悹鈧敃鍌氱？闊洦鏌ｆ禍婊堟煛閸モ晛鏋旈柣顓熷浮閺岋紕浠﹂崜褉濮囩紓浣虹帛缁诲牆鐣烽悢纰辨晢濞达絽婀卞Σ鎴犵磽閸屾艾鈧嘲霉閸ャ劊浠堥柛婵勫劜閺嗘粓鏌嶉妷锕€澧柛銈嗘礃閵囧嫰寮村Δ鈧禍鎯旈悩闈涗粶妞ゆ垵鎳橀崺鐐哄箣閿曗偓闁卞洦绻濇繝鍌涘櫤闁哄棛澧楃换婵嬫偨闂堟刀銉╂煛娴ｅ憡鍟為柟渚垮妼椤撳吋寰勬繝鍕Е婵＄偑鍊栫敮鎺斺偓姘煎墰婢规洘绻濆顓犲幍闂佸憡鎸嗛崨顓狀偧闂備焦濞婇弨閬嶅垂閸ф钃熸繛鎴炃氶弨浠嬫煕閳╁喚娈㈠ù鐘冲劤閳规垿鎮╅顫闂備浇顫夐鏍窗濮樺崬顥氶柛蹇曨儠娴滄粓鏌￠崘銊︽悙濞存粌缍婂顐﹀醇閵夛箑鈧灚绻涢崼婵堜虎闁哄鍠庨埞鎴︽倷鐠囇嗗惈濡ょ姷鍋涢崯瀛樻叏閳ь剟鏌曢崼婵囶棞濞存粍顨婇弻鐔兼嚌閻楀牆娑х紓鍌氱Т濡繂鐣?(Refresh)', processedRacks, 'success');
          setRacks(processedRacks);
      }
      if(resDev.ok) {
          const rawDevices = await resDev.json() || [];
          const metaRegex = /__META__:({.*})$/;
          const processedDevices = rawDevices.map(d => {
              const cleanD = {
                  ...d,
                  position: safeInt(d.position, 1),
                  u_height: safeInt(d.u_height, 1),
                  power_usage: safeInt(d.power_usage, 0),
                  typical_power: safeInt(d.typical_power, 0)
              };

              if (cleanD.specs && metaRegex.test(cleanD.specs)) {
                  try {
                      const match = cleanD.specs.match(metaRegex);
                      const meta = JSON.parse(match[1]);
                      return { ...cleanD, ...meta, specs: cleanD.specs.replace(metaRegex, '').trim() };
                  } catch(e) { return cleanD; }
              }
              return cleanD;
          });
          setRackDevices(processedDevices);
      }
    } catch (err) { console.error("Data load failed", err); }
    finally { setIsDataLoading(false); }
  };

  const handleJumpToDc = (dcId) => {
    setActiveTab('dcim');
    setActiveLocation(dcId);
  };

  useEffect(() => { if (isLoggedIn) refreshData(); }, [isLoggedIn]);

  const handleSaveIP = async () => {
    if(!ipFormData.ip_address) return alert('IP 闂傚倸鍊搁崐鎼佸磹妞嬪孩顐芥慨姗嗗墻閻掕棄鈹戦悩宕囶暡闁抽攱妫冮弻娑㈠即閵娿儰鑸梺缁樻煥濡瑦绌辨繝鍥舵晬婵炲棙甯╅崝鍛存⒑缂佹ê绗傜紒顔界懇瀵鈽夐姀鐘电杸闂侀潧顭梽鍕偟閺嶎厽鈷戠€规洖娲ㄧ敮娑欐叏婵犲偆鐓奸柛鈹惧亾濡炪倖宸婚崑鎾剁磼閻樿尙效鐎规洘娲熼弻鍡楊吋閸℃ぞ缃曢梻浣虹《閸撴繄绮欓幋锕€纾奸柕濞炬櫆閻撴稑顭跨捄渚剰闁诲繐绉垫穱濠囧箵閹烘柨鈪甸梺鍝勭灱閸犳牠鐛幋锕€绠涢柛顭戝亞缁夐攱淇婇悙顏勨偓鏇犳崲閹烘挾绠鹃柍褜鍓熼弻?);
    const url = editingIP ? `/api/ips/${editingIP.id}/` : '/api/ips/';
    const method = editingIP ? 'PUT' : 'POST';
    
    // 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓缂佺姳鍗抽弻鐔兼⒒鐎靛壊妲紓浣哄Х婵炩偓闁哄瞼鍠栭幃褔宕奸悢鍝勫殥缂傚倷鑳舵慨鐢告偋閺囥垹鐓橀柟杈鹃檮閸嬫劙鏌涘▎蹇ｆЧ闁诡喗鐟х槐鎾寸瑹閸パ傜盎缂備礁顦悥濂哥嵁婢跺娼扮€光偓閳ь剟鎮块埀顒勬⒑閸︻叀妾搁柛銊╀憾閹ɑ绗熼埀顒€顫忛搹瑙勫厹闁告侗鍠栧☉褔姊婚崒姘仼閻庢矮鍗冲畷鍝勨槈閵忕姴宓嗛梺闈涢獜缁辨洟宕㈤悽鍛娾拻濞撴艾娲ゅ璺ㄧ磼閻樺啿鐏撮柟顔斤耿閸╁嫰宕橀敂璺ㄧ泿闂備線娼ч¨鈧紒鐘冲灴閹﹢骞橀鐣屽幐闁诲繒鍋涙晶浠嬧€栭懖鈺冪＜闁绘ê纾ú瀛橆殽閻愯揪鑰块柟鐓庣秺椤㈡洟鏁愭惔鈩冩毉闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢埗鑺ョ☉閳藉濮€閻樼數宕堕梻浣告惈缁嬩線宕㈤幆褏鏆ゅ〒姘ｅ亾闁哄瞼鍠愬蹇涘箚瑜忓Σ锝夋⒑鏉炴壆顦︽い鎴濐樀瀵鈽夐姀鐘靛姶闂佸憡鍔︽禍婵嬪闯椤旂⒈娓婚柕鍫濈箰閻︽粓鏌涢敐蹇曞埌妞ゎ偄绻掔槐鎺懳熼懖鈺傚殞闂備焦鎮堕崕婊堝礃閻愵兛姘﹂梻鍌氬€峰ù鍥敋瑜忛幑銏ゅ箣閻樺啿搴婇梺鍓插亝缁诲嫰寮抽敃鍌涚厪闊洤顑呴埀顒佹礀濞插灝鈹戦悩顔肩伇婵炲鐩、鏍炊椤掆偓閸屻劑鏌熼悜姗嗘畷闁稿﹤鐏氶〃銉╂倷閼碱兛铏庨梺鍛婃⒐瀹€鎼佸蓟閻旈鏆嬮梺顓ㄧ畱閸撲即鏌涘Δ鈧畷顒勫煘閹达附鍋愮€规洖娴傞弳锟犳⒑缂佹ɑ灏版繛鍙夘焽閹广垹鈽夐姀鐘茶€垮┑鈽嗗灥濞咃絾绂掗幘顔藉€垫繛鎴炵懅缁犳牜绱?    let cleanDesc = (ipFormData.description || '').replace(/__TAG__:(.*)$/m, '').replace(/__LOCKED__:(true|false)/m, '').trim();
    
    let hiddenMeta = '';
    if (ipFormData.tag) hiddenMeta += `\n__TAG__:${ipFormData.tag}`;
    if (ipFormData.is_locked) hiddenMeta += `\n__LOCKED__:true`;

    const payload = { 
        ...ipFormData, 
        subnet: selectedSubnetId, 
        nat_type: ipFormData.nat_type || 'none',
        // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕婵犵绻濆褑鐏掗梺鍏肩ゴ閺呮繈鎮為崗鑲╃闁圭偓娼欓悞褰掓煕鐎ｎ偅宕岄柡宀€鍠栭、娆撳箚瑜屾竟鏇㈡⒑闂堟稓澧崇紓宥勭閻ｅ嘲顫滈埀顒佷繆閹间焦鏅濋柍褜鍓涚划濠囧醇閺囩啿鎷绘繛杈剧到閹诧繝骞嗛崼鐔翠簻闁挎棁妫勯ˉ瀣煃瑜滈崜娑㈡偡閹惰棄宸濇い鎾跺Х閻℃﹢姊绘担鍝勫付妞ゎ偅娲熷畷鎰板箛閺夎法锛涢梺鍦亾閺嬪ジ寮搁弮鍫熺厱妞ゎ厽鍨甸弸鐔兼煟韫囨挾澧︽慨濠冩そ瀹曠兘顢樺☉娆忕彵闂備胶顭堥鍛存晝閵堝鍋╅柣鎴ｆ娴肩娀鏌涢弴鐐差劉婵☆偄鍟悾鐑藉Ω閳哄﹥鏅ｉ梺缁樼憿閸嬫捇鏌涢悙鑸电【闁宠鍨块幃鈺咁敊閼测晙绱樻繝鐢靛仜椤︿即鎯勯鐐叉瀬闁告劦鍠栧敮闂佸啿鎼崯顐ャ亹閸℃娓婚柕鍫濇缁楁帡鏌涙繝鍛惞濠㈣娲樼缓浠嬪川婵犲嫬骞嶆俊鐐€栭悧鏇炍涢弬娆炬富闁圭儤鏌ㄩ崹婵堟喐韫囨洘顫曢柟鎯х摠婵挳鏌ц箛鏇熷殌缂佹せ鈧枼鏀芥い鏃囶潡濠婂牆绀夐柟杈剧畱閺勩儵鏌嶈閸撴岸濡甸崟顖氱鐎广儱鐗嗛崢锟犳⒑閹颁礁鐏℃繛鑼枛瀵濡搁埡浣稿祮闂侀潧顭堥崕鎵姳閽樺鏀介柍銉ュ暱缁狙囨煕閺冣偓濞茬喖宕洪悙鍝勭闁绘﹩鍋勬禍楣冩煥濠靛棝顎楀ù婊呭仱閺屾盯寮捄銊ョ厽濠殿喖锕ュ钘夌暦濠婂牊鍤戞い鎺嗗亾閻㈩垬鍎靛娲传閵夈儛锝夋煟濡や胶鐭掔€殿噮鍋婇、姘跺焵椤掑嫮宓侀幖娣妽閸ゅ秹鏌曟竟顖氬暙缁犵偛鈹戦悩鎰佸晱闁哥姵顨婇弫鍐煛閸涱厾顦┑顔筋焾濞夋稓绮婚弻銉︾叆婵犻潧妫欓ˉ鎾趁瑰鍕煉闁绘搩鍋婂畷鑸殿槹鎼粹€崇厒濠电姭鎷冮崘顏呮喖濡炪們鍔婇崕鐢稿箖濞嗘挻鍤戞い鎴€ら崟鈺€绨婚梺闈涚箚閸撴繄绮堢€ｎ喗鐓涘ù锝囨嚀婵秶鈧娲忛崝鎴︺€佸Δ鍛＜婵犲﹤瀛╂晥闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愬弶鐤勯梻浣筋嚃閸ㄥ海浠﹂幆褍鍘為梻鍌欑劍鐎笛兠洪弽顓炵；濠电姴瀚粈濠囨煛瀹ュ骸骞楅柣鎾卞劦閺岋繝宕橀妸銉㈠亾閸涘﹦顩插Δ锝呭暞閸婂灚鎱ㄥ鍡楀箻妞わ絾鐓￠弻鏇㈠炊瑜嶉顓犫偓娈垮枙缁瑦淇婇幖浣肝╅柕澶樺枟椤ャ倝姊?        status: ipFormData.is_locked ? 'online' : (ipFormData.status || 'online'),
        description: cleanDesc + hiddenMeta
    };

    // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閾忣偅鐝ㄦ繝纰夌磿閸嬫垿宕愰妶澶婂偍濠靛倻顭堟惔濠囨煛鐏炶鍔氶柣鎾寸箘閳ь剙绠嶉崕鍗炍涘▎鎾崇？闁绘柨鍚嬮悡蹇撯攽閻愯尙浠㈤柛鏂诲€栭妵鍕晜鐠囨彃绫嶉梺璇″枟椤ㄥ﹪鎮伴鈧畷褰掝敊閻撳寒娼涘┑鐘垫暩閸嬬偛顭囧▎鎾崇９闁革富鍘搁崑鎾绘濞戞牕浠悗瑙勬礃鐢帡锝炲┑瀣櫜闁糕檧鏅滅紞宀勬⒒閸屾瑦绁版い顐㈩樀瀹曟洟骞庨懞銉ヤ槐闂侀潧臎閸屾粌澧鹃梻浣圭湽閸ㄥ綊骞夐敓鐘冲亗婵炴垶鈼よぐ鎺撴櫜濠㈣泛顑嗛柨顓㈡⒑闁偛鑻晶顖涖亜閵娿儻韬€规洘妞介崺鈧い鎺嶉檷娴滄粓鏌熼崫鍕ラ柛蹇撶焸閺屽秹顢涘☉娆戭槰闂侀潧娲ょ€氱増淇婇幖浣肝ㄩ柨鏃傜帛閿涘棙淇婇悙顏勨偓鎴﹀垂濞差亝鍋￠柕澶嗘櫆閸嬧晜绻濋棃娑卞剰缂佲偓鐎ｎ偁浜滈柟鍝勭Ф閸斿秹鏌ｅ┑鎰喊闁哄矉绲鹃幆鏃堝灳閸愯尪绶熼梻浣侯焾椤戝棝骞戦崶顒€钃熸繛鎴欏灩閸楁娊鏌曟繛鍨偓妤呭极閺嶎偆纾藉ù锝勭矙閸濊櫣鈧厜鍋撶紒瀣儥濞兼牠鏌ц箛鎾磋础闁活厽鐟╅幃褰掑箒閹烘垵顬嬪銈嗘煥濞层劎妲愰幘瀛樺闁告挸寮舵晥闂備胶鎳撻幉鈩冪箾婵犲洦鍋樻い鏇楀亾鐎规洘锕㈡俊鍛婃償閵忊槅妫冮悗瑙勬礃閿曘垽銆侀弮鍫濈妞ゆ劑鍎涢弴鐐╂斀闁挎稑瀚禍濂告煕婵犲啰澧甸柟顔ㄥ吘鏃堝礃椤忓棛鍘梻浣侯攰閹活亞绱為崱娑樻辈闂侇剙绉甸埛?    delete payload.is_locked;

    try {
        const res = await safeFetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            if (ipFormData.tag) {
                updateHistory({ tag: ipFormData.tag });
            }
            alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕ㄩ婊咃紲闂佺粯鐟ラ幊鎰矓椤曗偓閺屸€崇暆閳ь剟宕伴弽顓炶摕闁搞儺鍓氶弲婵嬫煃瑜滈崜姘跺疾閸洦鏁婂┑顔藉姃缁?);
            setIsIPModalOpen(false);
            refreshData();
        } else {
            let errorMsg = '濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧孝缂佺粯甯￠幃鐐綇閳哄啰锛滈梺鍛婃尫缁€浣圭鏉堚斁鍋撳▓鍨灈闁绘牜鍘ч悾閿嬬附閸撳弶鏅濆銈庡亽閸樺ジ宕甸柆宥嗙厽?;
            try { const data = await res.json(); errorMsg = JSON.stringify(data); } catch(e) { errorMsg = await res.text(); }
            alert(`濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧孝缂佺粯甯￠幃鐐綇閳哄啰锛滈梺鍛婃尫缁€浣圭鏉堚斁鍋撳▓鍨灈闁绘牜鍘ч悾閿嬬附閸撳弶鏅濆銈庡亽閸樺ジ宕甸柆宥嗙厽? ${errorMsg}`);
        }
    } catch(e){ alert('缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ' + e.message); }
  };

  const handleDeleteIP = async (id) => { if(!confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪妶澶婄厴闁硅揪闄勯崑鎰版倵閸︻厼孝妞ゃ儲绻勭槐鎾存媴閹绘帊澹曢梻浣虹《閸撴繄绮欓幒妤佸亗闁绘棃鏅茬换鍡樸亜閺嶃劎绠撳ù婊冪秺閹粙顢涘☉姘垱闂佸搫鐭夌徊浠嬪煘閹达箑閱囨繝闈涙川娴滎亪姊?IP 闂傚倸鍊搁崐宄懊归崶褏鏆﹂柛顭戝亝閸欏繘鏌熼幆鏉啃撻柛濠傛健閺屻劑寮村Δ鈧禍鎯ь渻閵堝骸骞栭柣蹇旂箚閻忔帡姊洪崗鑲┿偞闁哄懏绻堣棟妞ゆ牜鍋為崐鍨殽閻愯尙浠㈤柛鏃€纰嶉妵鍕晜鐠囪尙浠梺鐟板级閹告娊寮崒鐐茬闁圭儤姊婚悾楣冩⒒娓氣偓濞佳囨偋閸℃稑绠悗锝庡枛绾惧潡鏌熸潏楣冩闁?)) return; try { const res = await safeFetch(`/api/ips/${id}/`, { method: 'DELETE' }); if(res.ok) refreshData(); } catch(e){} };
  const openOptionManager = (key) => setManagingOptionKey(key);

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setUserModalMode('create');
    setUserFormData({});
  };

  const handleOpenCreateUser = () => {
    setUserModalMode('create');
    setUserFormData({
      role: 'guest',
      is_active: true,
      must_change_password: true,
      department: '',
      phone: '',
      title: '',
      display_name: '',
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setUserModalMode('edit');
    setUserFormData({
      id: user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      department: user.department || '',
      phone: user.phone || '',
      title: user.title || '',
      role: user.role || 'guest',
      is_active: user.is_active,
      must_change_password: !!user.must_change_password,
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    const isEditingUser = userModalMode === 'edit' && userFormData.id;
    if (!userFormData.username) {
      alert('闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€鍩￠崨顔间画濠电偛妫欓悷銉┿€呴鍕厓鐟滄粓宕滃▎鎴犱笉鐎广儱顦壕鍧楀级閸碍鏉归柛瀣尭椤繈鎮℃惔銏㈠綆闂備浇顕栭崰鏍床閺屻儱鐓橀柟瀵稿Л閸嬫捇鏁愭惔鈥茬敖闂佸憡锕㈢粻鏍ь潖濞差亜绠氱憸搴ｇ矉鐎ｎ喗鐓曢悗锝庝簻椤忣參鏌熼缂存垹鎹㈠┑瀣倞闁靛鍎伴崠鏍⒒娴ｅ摜绉洪柛瀣躬瀹曚即寮介鐐插殤闂佸搫鍟崐鑽ゅ?);
      return;
    }
    if (!isEditingUser && !userFormData.password) {
      alert('闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫宥夊礋椤掍焦顔囨繝寰锋澘鈧洟宕姘辨殾闁哄被鍎查悡鏇犫偓鍏夊亾闁逞屽墴瀹曟洟骞嬮悩鐢殿槸闂佸搫绋侀崢浠嬫偂濞嗘挻鈷戞い鎾卞妿閻ｉ亶鏌＄€ｎ偅宕岄柡灞剧〒閳ь剨缍嗛崑鍛暦鐏炲彞绻嗘い鎰╁灩閺嗘瑩鏌嶉挊澶樻Ц闁宠楠歌灒濞村吋鐟╅悰婊堟⒒閸屾艾鈧兘鎳楅崜浣稿灊妞ゆ牜鍋為崑瀣繆閵堝懎鏆欓柛銊︾箘閳ь剙绠嶉崕鍗灻洪妸鈺傚剹婵炲棗娴氶悢鍡涙偣鏉炴媽顒熼柣鎿冨墴閺屾稑顫濋澶婂壎闂佸搫鏈惄顖炪€侀弴銏℃櫜闁搞儮鏅濋弳銈嗕繆閵堝洤啸闁稿鐩、鏍幢濞嗘劕搴婂┑鐐村灟閸ㄥ湱绮婚敐澶嬬厽闁归偊鍘界紞鎴犵棯闁款垱娅呴柍瑙勫灴閹瑩宕ｆ径濠勫絽缂傚倸鍊哥粔宕囨濮橆剛鏆?);
      return;
    }

    const payload = {
      username: userFormData.username,
      display_name: userFormData.display_name || userFormData.username,
      department: userFormData.department || '',
      phone: userFormData.phone || '',
      title: userFormData.title || '',
      role: userFormData.role || 'guest',
      is_active: userFormData.is_active ?? true,
      must_change_password: userFormData.must_change_password ?? true,
    };

    if (!isEditingUser) {
      payload.password = userFormData.password;
    }

    try {
      const url = isEditingUser ? `/api/users/${userFormData.id}/` : '/api/users/';
      const method = isEditingUser ? 'PATCH' : 'POST';
      const res = await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert(isEditingUser ? '闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷閭﹀殶闁稿鍠栭獮濠囧川鐎涙鍘撻梺鑽ゅ枑婢瑰棙鏅ラ梻浣告惈閼活垳绮旇ぐ鎺戞槬闁斥晛鍟刊鎾煕濞戞﹫鏀绘い鎾规硶缁辨捇宕掑▎鎰偘婵＄偛鐡ㄩ幃鍌炲箖瑜嶉…銊╁醇濠靛牆濮︽俊鐐€栧濠氬磻閹惧绡€闁逞屽墴閺屽棗顓兼担鎻掍壕闁挎洖鍊搁柋鍥ㄧ節閸偄濮囨繛鍫涘姂閺岋綁鎮╅崣澶嬪創闂侀潧鐗愬Λ鍕弲濡炪倕绻愮€氫即寮鍐ｆ斀閹烘娊宕愰幇鏉跨；闁瑰墽绻濈换? : '闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€鍩￠崘顏嗭紲闂侀€炲苯澧寸€规洖宕灒闁兼祴鏅╅崯搴ㄦ⒒娴ｇ儤鍤€妞ゆ洦鍙冨畷鏇㈠箛閻楀牆鈧潡鏌ｉ敐鍛伇缁炬儳銈搁弻鐔煎箵閹烘繂鍓抽梺浼欑悼閺佸寮婚垾宕囨殕闁逞屽墴瀹曚即骞樼拠鑼姦濡炪倖甯婇懗鍫曞煀閺囥垺鐓ユ慨姗嗗厴閺€鑺ャ亜閺傚灝鎮戦柟鍏煎姍閺?);
        closeUserModal();
        refreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || JSON.stringify(err) || (isEditingUser ? '闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€鍩￠崨顔惧幈濠德板€撶粈渚€鍩㈤弴銏＄厵妞ゆ梻鐡斿▓鏃堟煃閽樺妲搁柍璇茬Ч閹煎綊顢曢姀顫礉闂備浇顕栭崳顖滄崲濠靛鏄ラ柍褜鍓氶妵鍕箳瀹ュ牆鍘＄紓浣叉閸嬫捇姊绘笟鈧褏鎹㈤崱娑樼劦妞ゆ巻鍋撻柛鐔稿閹便劑宕妷褏锛濇繛鎾磋壘濞层倝寮稿☉姗嗙唵鐟滃瞼鍒掑▎鎾跺祦? : '闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€鍩￠崘顏嗭紲闂侀€炲苯澧寸€规洖宕灒闁兼祴鏅╅崯搴ㄦ⒒娴ｇ儤鍤€妞ゆ洦鍙冨畷鏇㈠箛閻楀牆鈧潡鏌ｉ敐鍛伇缁炬儳銈搁弻鐔煎箵閹烘繂鍓抽梺浼欑秬妞存悂濡甸崟顖ｆ晣闁绘劖娼欐禒鏉懳旈悩闈涗粶婵☆偅绻堥悰顔碱吋婢舵ɑ鏅╅梺鍛婃寙閸愩劎褰戦梻?));
      }
    } catch (e) {
      alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ${e.message}`);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф疁闁哄备鈧剚鍚嬮幖绮光偓宕囶啈闂備胶顭堥鍌炲疾閻樿钃熸繛鎴欏灩缁犵粯淇婇妶鍌氫壕闁诲孩鍑归崜鐔奉嚕閹剁瓔鏁冮柨婵嗘川椤旀洟鏌℃径濠勫濠⒀傜矙楠炲啴宕楃粭杞扮盎濡炪倖鎸鹃崑鐔告櫠閿曞倹鐓欐い鏃€鏋婚懓鍧楁煕閳哄绡€鐎规洏鍔戦、娆戞喆閸曨偒浼滈梻鍌氬€风粈渚€骞夐垾瓒佸搫顓兼径濠勬煣濠电偞鍨崹褰掓倿閸偁浜滈柟鍝勭Ф鐠愮増绻涢崼鐔虹煂闁逞屽墯椤旀牠宕抽鈧畷鎴炵節閸愌呯畾闂佸吋鎮傚褏娆㈤悙娴嬫斀闁绘ɑ褰冮鎾煕濮橆剚鍤囨慨濠呮閹风娀鎳犻鍌ゅ敹缂傚倷娴囬褔顢栭崶顒€绠悗锝庡枛閽冪喖鏌曟径鍫濆姢闁?{user.username}闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀绾惧鏌曟繛鐐珔缁炬儳娼￠弻銈囧枈閸楃偛顫悗瑙勬礃閻擄繝寮诲☉妯兼殕闁逞屽墴瀹曟垵鈽夊鍙樼瑝闂佸搫绋侀崑鍛村窗閹扮増鐓涢柛鎰╁妿婢ф洟鏌＄€ｂ晞鍏岄柍褜鍓欑粻宥夊磿闁单鍥ㄥ閺夋垹锛?) return;
    try {
      const res = await safeFetch(`/api/users/${user.id}/`, { method: 'DELETE' });
      if (res.ok) {
        refreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || '闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€鍩￠崘顏嗭紲闂侀€炲苯澧寸€规洖宕埥澶娾枎閹存繂绠哄┑鐘殿暯濡插懘宕归悽绋跨；闁归偊鍠楅弳婊勭箾閹存瑥鐏柣鎾跺枑缁绘繈妫冨☉姘暫闂佸搫顑呯€涒晠濡甸崟顖ｆ晣闁绘劖娼欐禒鏉懳旈悩闈涗粶婵☆偅绻堥悰顔碱吋婢舵ɑ鏅╅梺鍛婃寙閸愩劎褰戦梻?);
      }
    } catch (e) {
      alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ${e.message}`);
    }
  };

  const handleToggleUserActive = async (user) => {
    if (user.username === currentUserInfo?.username) {
      alert('濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙缂佺姳鍗抽弻娑樷攽閸曨偄濮㈤梺娲诲幗閹瑰洭寮婚敐澶婄闁挎繂妫Λ鍕磽娴ｆ彃浜鹃梺绋挎湰缁嬫帡宕ｈ箛鏂剧箚闁绘劙顤傞崵娆徝瑰鍫㈢暫闁诡喗顨堥幉鎾礋椤掑偆妲伴梻浣规偠閸斿酣寮繝姘伋闁挎洖鍊告儫闂佸疇妗ㄧ粈浣虹玻濞戞﹩娓婚柕鍫濇椤ュ棗鈹戦鍝勨偓婵嬨€佸Ο瑁や汗闁圭儤鎸鹃崢浠嬫⒑缂佹ɑ鐓ラ柟鑺ョ矒閹瞼浠︾粵瀣數閻熸粌閰ｉ妴鍐╃節閸モ晛绁﹂梺鍦濠㈡ê顔忓┑鍡忔斀闁绘ɑ褰冮弳鐐烘煟濠靛牆鍘存慨濠呮缁辨帒顫滈崱娆忓Ш缂傚倷绶￠崳顕€宕圭捄铏规殾闁哄洨鍋熼弳鍡涙煕閺囥劌澧ù鐙€鍨跺娲箹閻愭彃濮舵繛瀛樼矋缁捇骞嗛崘顔芥優闁革富鍘鹃敍婊勭節閵忥絾纭鹃柨鏇樺劦瀹曟垿濡烽埡鍌滃幍濡炪倖妫侀崑鎰矓閻戞﹩娈介柣鎰级閸犳鈧娲樼划宥夊箯閸涘瓨鍊绘俊顖涙た閸熷懘姊?);
      return;
    }
    const nextActive = !user.is_active;
    if (!confirm(`缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф疁闁哄备鈧剚鍚嬮幖绮光偓宕囶啈闂備胶顭堥鍌炲疾閻樿钃熸繛鎴欏灩缁犵粯淇婇妶鍌氫壕闁诲孩鍑归崜鐔奉嚕?{nextActive ? '闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閼碱剦妲遍柣鐔哥矌婢ф鏁幒妤€鍨傞柛宀€鍋為悡娆撴煙椤栨粌顣兼い銉ヮ樀閺? : '缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕閻庤娲橀崝娆撳箖濠婂牊鍤嶉柕澶堝劜閻ｉ亶姊绘担绋款棌闁稿鎳庣叅闁哄稁鍘奸崙?}闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€鍩￠崨顔惧幗?{user.username}闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀绾惧鏌曟繛鐐珔缁炬儳娼￠弻銈囧枈閸楃偛顫悗瑙勬礃閻擄繝寮诲☉妯兼殕闁逞屽墴瀹曟垵鈽夊鍙樼瑝闂佸搫绋侀崑鍛村窗閹扮増鐓涢柛鎰╁妿婢ф洟鏌＄€ｂ晞鍏岄柍褜鍓欑粻宥夊磿闁单鍥ㄥ閺夋垹锛?) return;
    try {
      const res = await safeFetch(`/api/users/${user.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (res.ok) {
        refreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || '闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷褰掝敋閸涱垰濮洪梻浣侯潒閸曞灚鐣剁紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忓瘜閸ㄨ泛顕ｆ导鏉懳ㄩ柨鏂垮⒔椤旀洟姊洪悷鎵憼闁荤喆鍎甸幃姗€顢旈崼鐔哄幈闁诲函缍嗛崑鍕叏瀹ュ鐓涢悘鐐额嚙閳ь剚绻傞悾鐑筋敃閿曗偓鍞銈嗘婵倝鎯佸鍫熲拻濞达絼璀﹂悞鐐亜閹存繃顥㈡鐐村姈缁绘繂顫濋鍌ゅ數闂備礁鎲℃笟妤呭垂闁秴绐楅柛鈩冪⊕閻撴洟鏌￠崶銉ュ妤犵偞鐗犻弻娑㈠Χ婢跺鍠氬┑顔硷功缁垶骞忛崨鏉戝窛濠电姴鍟崜鐢告⒒娴ｄ警鐒鹃柨鏇畵楠炲﹪骞橀悜鈹惧亾閿曞倸鍨傛い鏇炴噺瀵ゆ椽姊洪柅鐐茶嫰婢ь垰菐閸パ嶈含闁诡喚鏅划娆戞崉椤垵鎮堥梻鍌欒兌缁垶鏁嬮梺鍝ュ枎濞硷繝銆?);
      }
    } catch (e) {
      alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ${e.message}`);
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      const res = await safeFetch(`/api/users/${userId}/unlock/`, { method: 'POST' });
      if (res.ok) {
        alert('闂傚倸鍊搁崐宄懊归崶褏鏆﹂柛顭戝亝閸欏繘鏌ｉ姀銏╃劸缂佲偓婢跺本鍠愰煫鍥ㄦ礀閸ㄦ繂鈹戦悩瀹犲缂佺媴缍侀弻銊モ攽閸℃娈ㄥ┑顔款潐椤ㄥ﹤顫忓ú顏勭闁肩⒈鍓欑敮銉╂⒑闂堚晝绉甸柛锝忕到閻ｇ兘顢涢悙鎻掔獩闁诲孩绋掗…鍥储妤ｅ啯鈷戦柛蹇氬亹閵堟挳鏌￠崨顔剧畼缂侇喖鐗忛埀顒婄秵閸犳鎮″▎鎾寸厽闁瑰鍎戞笟娑欑箾閸喐绀嬮柡?);
        refreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || '闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾缁愭鏌熼幍顔碱暭闁稿绻濆鍫曞醇濮橆厽鐝栫紓浣插亾濠电姴鍊堕埀顒佸笒椤繈鏁愰崨顒€顥氶梺璇插椤旀牠宕伴幘璇茬闁硅揪绠戦弸渚€鏌熼悧鍫熺凡妤犵偑鍨烘穱濠囧Χ閸涱厽娈堕梺缁樹緱閸ｏ絽顫忓ú顏勪紶闁告洖鐏氱瑧闂備胶绮〃鍡欏垝閹惧磭鏆﹂柟瀵稿仜缁剁偤骞栭幖顓炴灍婵?);
      }
    } catch (e) {
      alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ${e.message}`);
    }
  };

  const handleResetConfirm = async () => {
    if (!resetTarget.password) {
      alert('闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晝閳ь剛澹曡ぐ鎺撶厽闁绘梻鍘ф禍浼存煟閺傛寧顥為柟渚垮妼椤啰鎷犻煫顓烆棜闂傚倷娴囬鏍垂椤栨粍顐芥慨妯哄瀹撲線鎮楅敐搴℃灍闁哄懏绮撻弻锕€螣娓氼垱笑婵犮垼顫夐幐鎼佸煘閹达附鍊烽柤鎼佹涧濞懷呯磽閸屾氨小缂佽埖淇哄Λ銏ゆ⒑閻熸澘鈷旂紒顕呭灦瀹曟垿鍩勯崘顏嗙槇闂傚倸鐗婃笟妤呭磿閹扮増鐓熼柟鎹愭硾閳诲牓鏌＄仦鐔锋閻も偓闂佹寧绻傞幊宥囪姳婵犳碍鈷戦悹鍥皺缁犱即鏌ㄩ弴銊ら偗妤犵偛鍟抽妵鎰板箳閹寸姷鏉告俊鐐€栭弻銊╁触鐎ｎ喗鍊跺ù锝堟绾?);
      return;
    }
    try {
      const res = await safeFetch(`/api/users/${resetTarget.id}/`, {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          password: resetTarget.password,
          must_change_password: resetTarget.must_change_password ?? true,
        }),
      });
      if (res.ok) {
        alert('闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滄棃寮绘繝鍥ㄦ櫜闁告粈鑳堕崝鐑芥偡濠婂啰啸闁诲繐顑呴埞鎴︽倷閺夋垹浠ч梺鎼炲妽濡炶棄鐣烽幋鐐茬窞閻庯綆鍓涢惁鍫熺節閻㈤潧孝闁稿﹥鎮傚鎼佸Χ婢跺鍘遍梺缁樻閺€閬嶅吹閸ヮ剚鐓涚€光偓鐎ｎ剛锛熸繛瀵稿婵″洭骞忛悩璇茬闁圭儤鍩堝娑樷攽閻樺灚鏆╅柛瀣洴楠炲﹤鐣濋崟顐㈢€梺鐓庮潟閸婃牠锝?);
        setIsResetModalOpen(false);
        setResetTarget({});
        refreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || JSON.stringify(err) || '闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滄棃寮绘繝鍥ㄦ櫜闁告粈鑳堕崝鐑芥偡濠婂啰啸闁诲繐顑呴埞鎴︽倷閺夋垹浠ч梺鎼炲妽濡炶棄鐣烽幋鐐茬窞閻庯綆鍓涢惁鍫熺節閻㈤潧孝闁稿﹦绮弲璺衡槈閵忥紕鍘介梺瑙勫劤閸熷潡鍩€椤掆偓椤兘宕洪埀顒併亜閹哄棗浜剧紓浣哄Т缁夌懓鐣烽弴銏犵闁诲繒绮鑺ヤ繆閹间礁鐓涘ù锝囶焾濞堛倝姊绘担渚劸闁哄牜鍓熷畷娆掋亹閹烘挸浜滈梺绯曞墲缁嬫帡鎮″▎鎰╀簻闁哄秲鍔庨埥澶嬨亜閵夈儺鍎戠紒杈ㄥ浮婵℃悂濡烽敃鈧禒鎾⒑?);
      }
    } catch (e) {
      alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ${e.message}`);
    }
  };

  const handleChangeOwnPassword = async () => {
    if (!passwordFormData.current_password || !passwordFormData.new_password) {
      alert('闂傚倸鍊搁崐宄懊归崶褏鏆﹂柛顭戝亝閸欏繘鏌℃径瀣婵炲樊浜滃洿婵犮垼娉涢敃銈囪姳閵夆晜鈷戦柛婵嗗椤箓鏌涙惔銏㈠弨鐎殿喗鐓″濠氬Ψ閿旀儳骞楅梻浣哥秺閸嬪﹪宕滃璺虹畾闁割偁鍨荤壕濂告煃瑜滈崜鐔风暦濮椻偓閸╋繝宕橀宥呮櫗闂傚倷鑳剁涵鍫曞礈濠靛鈧啴宕奸姀顫瑝閻庤娲栧ú銊у閻撳寒鐔嗛悹杞拌閻掗箖鏌涚€ｃ劌鐏查柡宀嬬磿娴狅箓宕滆閸掓稑螖閻橀潧浠﹂柨姘舵煟閿濆洤鍘寸€规洖鐖煎畷閬嶅箛椤掑倷绱欓梻浣告惈閻绱炴笟鈧顐﹀磼閻愭潙鐧勬繝銏ｆ硾婵傛梻妲愬┑瀣拻濞达絿鐡旈崵鍐煕閵婏箑顥嬬紒顔芥閹晫绮欑捄顭戝數闂備礁鎲＄粙鎺戭焽濞嗗浚鍟呮繝闈涙閺€浠嬫煟濡绲诲ù婊呭仜闇夐柣鎾冲閸ゅ洦鎱ㄦ繝鍕笡闁瑰嘲鎳樺畷銊︾節閸愩劌澹嶉梻鍌欒兌椤牓鏁冮敃鍌氱疇闁瑰墽鍎甸埀顒婄畵瀹曞綊顢氶崨顔肩紦闂備線鈧偛鑻晶瀛橆殽閻愬弶顥炵紒妤冨枛閸┾偓妞ゆ帒瀚畵渚€鎮楅敐搴℃灍闁哄懏绮撻弻锕€螣娓氼垱笑婵?);
      return;
    }
    if (passwordFormData.new_password !== passwordFormData.confirm_password) {
      alert('濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙缂佺姳鍗抽弻娑㈩敃閿濆棛顦ョ紒鐐劤缂嶅﹪寮婚垾鎰佸悑閹肩补鈧啿顒滈梻浣芥〃缁€渚€宕幘顔艰摕婵炴垶绮庨悿鈧梺瑙勫礃濞呮洟宕愰婊呯＝闁稿本姘ㄥ瓭濠电偛妯婇崣鍐嚕婵犳碍鍋勯柣鎾虫捣閻ｉ箖鎮峰鍐х€殿喛娅曞蹇涘煘閹傚濠电偛鐗嗛悘婵嬪几閻斿皝鏀介柣鎰嚋闊剛鈧鍠栭…鐑藉极閹邦厼绶炲┑鐐╂噰閺呯娀寮婚弴鐔风窞闁割偅绻傛慨鑸电箾鐎电鈻堢紒鐘崇墪椤繐煤椤忓嫪绱堕梺鍛婃处閸犳牠顢旈銏♀拺闁圭瀛╃粚璺ㄧ磼閻樿櫕宕岀€规洘妞介崺鈧い鎺嶉檷娴滄粓鏌熼悜妯虹仴妞ゅ浚浜濈换娑㈠箠瀹勬澘顏х紒璇叉閵囧嫰骞囬崜浣瑰仹濠电偛寮堕幐鎶藉蓟閻旂⒈鏁婇柛婵嗗婵骸顪冮妶搴″箲闁告梹鍨甸悾鐑芥偄绾拌鲸鏅ｅ┑鐐村灦閻熝勭濞嗘挻鈷戦悹鍥ㄧ叀椤庢绱掗悩鑼х€规洘娲樺蹇涘煘閹傚濠殿喗顭囬崢褍鈻嶅鍡愪簻闁靛繆鍓濋ˉ鍫ユ煛鐏炶姤顥滄い鎾炽偢瀹曞崬鈻庤箛鎾额啋?);
      return;
    }
    try {
      const res = await changePasswordRequest({
        current_password: passwordFormData.current_password,
        new_password: passwordFormData.new_password,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        updateCurrentUserInfo(data.user);
        setPasswordFormData({ current_password: '', new_password: '', confirm_password: '' });
        setIsPasswordChangeModalOpen(false);
        alert('闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滄棃寮绘繝鍥ㄦ櫜闁告粈鑳堕崝鐑芥偡濠婂啰啸闁诲繐顑呴埞鎴︽倷閺夋垹浠ч梺鎼炲妽濡炶棄鐣烽幋鐐茬窞閻庯綆鍓涢惁鍫熺節閻㈤潧孝闁稿﹥鎮傞、鏃堫敃閿旂晫鍘撻梺鑽ゅ枑婢瑰棙鐗庨梻渚€娼уú銈団偓姘緲椤曪綁顢氶埀顒€鐣烽崼鏇椻偓鏍敊閼恒儱纾抽梺鍝勭焿缁绘繂鐣烽柆宥呯厸濞达絽鎽滈惈鍕⒒娴ｅ憡鎯堥柣顒€銈稿畷浼村箻鐠囪尙鍔﹀銈嗗笂閼冲爼鍩婇弴銏＄叆婵﹩鍏橀弨鑺ャ亜閺傚灝鎮戦柟鍏煎姍閺?);
      } else {
        alert(data.message || '闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滄棃寮绘繝鍥ㄦ櫜闁告粈鑳堕崝鐑芥偡濠婂啰啸闁诲繐顑呴埞鎴︽倷閺夋垹浠ч梺鎼炲妽濡炶棄鐣烽幋鐐茬窞閻庯綆鍓涢惁鍫熺節閻㈤潧孝闁稿﹥鎮傞、鏃堫敃閿旂晫鍘撻梺鑽ゅ枑婢瑰棙鐗庨梻渚€娼уú銈団偓姘緲椤曪綁顢氶埀顒€鐣烽崼鏇椻偓鏍敊閼恒儱纾抽梺鍝勭焿缁绘繂鐣烽柆宥呯厸濞达絽鎽滈鎰繆閻愵亜鈧倝宕㈤悡搴劷闁跨喓濮峰畵渚€鏌涢埄鍐槈缂佺姰鍎查妵鍕棘閸喒鎸冮梺鍛婃礃閿曘垹顫?);
      }
    } catch (e) {
      alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ${e.message}`);
    }
  };

  const handleSaveSubnet = async () => {
      if(!subnetFormData.name) return alert("缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮闁汇値鍠楅妵鍕冀椤愵澀绮堕梺鎼炲妼閸婂潡寮诲☉銏╂晝闁挎繂妫楅ˇ鈺呮⒑鏉炴壆顦﹂柨鏇畵閸┾偓妞ゆ巻鍋撻柛妯荤矒瀹曟垿骞樼紒妯煎幈闂佸搫娲㈤崝灞剧椤栨粍鍋栨繝闈涱儐閻撶喖骞栨潏鍓х？闁伙綆鍙冮弻娑欐償閳ュ疇鍩為梺宕囩帛濡啴寮崘顔肩＜婵炴垶菤閸嬫捇鎮滈懞銉у幈闂佽宕樼亸顏堝礂瀹€鍕厸濠㈣泛顑嗛崐鎰叏婵犲啯銇濈€规洏鍔嶇换婵囨媴閾忓湱鐣抽梻鍌欑閹诧繝鎮烽妷褎宕查柟鐑樻⒐椤?);
      const url = !!subnetFormData.id ? `/api/subnets/${subnetFormData.id}/` : '/api/subnets/';
      const payload = { ...subnetFormData, vlan_id: (subnetFormData.vlan_id && subnetFormData.vlan_id !== "") ? parseInt(subnetFormData.vlan_id) : null };
      try {
          const res = await safeFetch(url, {method: !!subnetFormData.id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          if(res.ok){
              alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕ㄩ婊咃紲闂佺粯鐟ラ幊鎰矓椤曗偓閺屸€崇暆閳ь剟宕伴弽顓炶摕闁搞儺鍓氶弲婵嬫煃瑜滈崜姘跺疾閸洦鏁婂┑顔藉姃缁?);
              setIsSubnetModalOpen(false);
              refreshData();
          } else { const err = await res.json(); alert('闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀缁犵娀鏌熼崜褏甯涢柛濠呭煐缁绘繈妫冨☉姘叡闂佹椿鍘介幐楣冨焵椤掑喚娼愭繛鍙夌墪鐓ら柕濞у懐鐒兼繝鐢靛Т濞诧箓鎮″☉銏＄厱闁规澘澧庨崚鏉棵瑰鍫㈢暫闁诡喗顨婂畷褰掝敃閿濆洤鍤掗梺璇插閸戝綊宕㈡總绯曗偓锕傚炊椤忓棛鏉稿┑鐐村灱妞存悂寮插┑瀣拺?\n' + JSON.stringify(err, null, 2)); }
      } catch(e){ alert('缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮闁汇値鍠楅妵鍕冀椤愵澀绮堕梺鎼炲妼閸婂潡寮诲☉銏℃櫆閻犲洦褰冪粻褰掓⒑閹肩偛濡界紒璇茬墦瀵鈽夐姀鈺傛櫇闂佹寧绻傚Λ娑⑺囬妸鈺傗拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ' + e.message); }
  };
  const handleSaveSection = async () => { if(!sectionFormData.name) return alert('闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愬弶鐤勯梻浣告啞閹稿棝宕ㄩ婊冨脯闂傚倷娴囬鏍垂鏉堛劎鐝堕悗锝庡枛閻鏌涜椤ㄥ棝鍩涢幒鎴旀斀闁绘ɑ鐓￠妤€霉濠婂嫮鐭嬬紒缁樼〒娴狅箓宕掑锝呬壕婵犻潧顑囧畵浣糕攽閻樻彃鏆為柛搴ｅ枛閺屾洘绻濊箛娑欘€嶅┑?); try{ const res = await safeFetch('/api/sections/', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(sectionFormData)}); if(res.ok){ alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕ㄩ婊咃紲闂佺粯鐟ラ幊鎰矓椤曗偓閺屸€崇暆閳ь剟宕伴弽顓炶摕闁搞儺鍓氶弲婵嬫煃瑜滈崜姘跺疾閸洦鏁婂┑顔藉姃缁?); setIsSectionModalOpen(false); refreshData(); setSectionFormData({}); } else { alert('闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀缁犵娀鏌熼崜褏甯涢柛濠呭煐缁绘繈妫冨☉姘叡闂佹椿鍘介幐楣冨焵椤掑喚娼愭繛鍙夌墪鐓ら柕濞у懐鐒兼繝鐢靛Т濞诧箓鎮″☉銏＄厱闁规澘澧庨崚鏉棵瑰鍫㈢暫闁诡喗顨婂畷褰掝敃閿濆洤鍤掗梺璇插閸戝綊宕㈡總绯曗偓锕傚炊椤忓棛鏉稿┑鐐村灱妞存悂寮插┑瀣拺闂傚牊渚楀Σ褰掓煕閺冣偓閻楁洜鍙呴梺缁樻⒒閸樠囨嫅閻斿吋鐓忓┑鐐茬仢閸旀淇婇幓鎺斿濞ｅ洤锕、娑橆煥閸愩劋绮梻浣瑰墯娴滐絾銇旈崫銉﹀床婵犻潧妫岄弸鏃堟煕椤垵鏋熼柣蹇撶Ч濮婅櫣鎷犻垾铏亪闂佺锕ゅ锟犲箖娴兼惌鏁嬮柍褜鍓熷畷娲焵椤掍降浜滈柟鍝勬娴滈箖姊婚崶褜妯€闁哄被鍔岄埞鎴﹀幢濞嗗浚鏉告俊鐐€曠换鎺撶箾閳ь剟鏌?' + res.status + '闂?); } } catch(e){ alert('缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愪粙鏌ㄩ悢鍝勑㈤柛銊ュ€垮濠氬醇閻旀亽鈧帡鏌￠崱顓犵暤闁哄矉缍佹慨鈧柕鍫濇闁款參姊洪幖鐐插缂佽鍟伴幑銏犫槈濮楀棗鏅犲銈嗘瀹曠敻宕欒ぐ鎺撯拺缂備焦蓱鐏忣亪鏌涙惔銈呯毢闁瑰箍鍨归埥澶愬閻樿尪鈧灝鈹戦埥鍡楃仴婵℃ぜ鍔戝畷姘節閸ャ劉鎷? ' + e.message); } };
  const handleDeleteSection = async (id) => { if(!confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪妶澶婄厴闁硅揪闄勯崑鎰版倵閸︻厼孝妞ゃ儲绻勭槐鎾存媴閹绘帊澹曢梻浣虹《閸撴繄绮欓幒妤佸亗闁绘棃鏅茬换鍡樸亜閺嶃劎绠撳ù婊冪秺閹粙顢涘☉姘垱闂佸搫鐭夌徊浠嬪煘閹达箑閱囨繝闈涙川娴滎亪姊绘担绛嬪殐闁哥姵鐗滅槐鐐寸節閸屾粍娈鹃梺鍓插亝濞叉牕鏁梻渚€娼чˇ顓㈠磿闁稄缍栭柟鍓х帛閳锋垿鎮归崶顏勭毢缂佺姷澧楃换娑氣偓娑櫭崫铏光偓瑙勬礀濠€閬嶅箲閸曨垱鎯為悷娆忓椤旀洘绻濋悽闈涗粶婵☆垰锕ョ粋宥呪攽鐎ｎ亞锛涢梺鍛婃处閸ㄩ亶鍩涢幋锔界厱妞ゎ厽鍨靛▍姗€鏌涙惔锛勭闂囧绻濇繝鍌滃闁硅尙鍋撻幈?)) return; try{ const res = await safeFetch(`/api/sections/${id}/`, {method:'DELETE'}); if(res.ok) refreshData(); } catch(e){} };
  const handleDeleteSubnet = async (id) => { if(!confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪妶澶婄厴闁硅揪闄勯崑鎰版倵閸︻厼孝妞ゃ儲绻勭槐鎾存媴閹绘帊澹曢梻浣虹《閸撴繄绮欓幒妤佸亗闁绘棃鏅茬换鍡樸亜閺嶃劎绠撳ù婊冪秺閹粙顢涘☉姘垱闂佸搫鐭夌徊浠嬪煘閹达箑閱囨繝闈涙川娴滎亪姊绘担绛嬪殐闁哥姵鐗滅槐鐐寸節閸屾粍娈鹃梺鍓插亝濞叉牕鏁梻渚€娼чˇ顓㈠磿鏉堫偒鏆紓鍌氬€搁崐鎼佸磹閹间礁纾归柛婵勫劤閻捇鏌熺紒銏犳殙闁搞儺鍓﹂弫宥夋煟閹邦垰鐨洪柛妯绘そ濮婃椽鎮烽弶搴撴寖缂備緡鍣崹鎯版＂闂佸壊鍋嗛崰鎾剁不妤ｅ啯鐓欓悗鐢殿焾娴犙囨煙閸愭彃鏆欓棁澶嬬節婵犲倻澧旈柟鑼亾閹?)) return; try{ const res = await safeFetch(`/api/subnets/${id}/`, {method:'DELETE'}); if(res.ok){ setSelectedSubnetId(null); refreshData(); } } catch(e){} };
  
  const handleSaveDatacenter = async (formData) => { 
      const url = formData.id ? `/api/datacenters/${formData.id}/` : '/api/datacenters/'; 
      try { const res = await safeFetch(url, { method: formData.id?'PUT':'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(formData) }); if(res.ok) { alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕ㄩ婊咃紲闂佺粯鐟ラ幊鎰矓椤曗偓閺屸€崇暆閳ь剟宕伴弽顓炶摕闁搞儺鍓氶弲婵嬫煃瑜滈崜姘跺疾閸洦鏁婂┑顔藉姃缁?); setIsDcModalOpen(false); refreshData(); } } catch(e){} 
  };
  const handleDeleteDatacenter = async (id) => { if(!confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪妶澶婄厴闁硅揪闄勯崑鎰版倵閸︻厼孝妞ゃ儲绻勭槐鎾存媴閹绘帊澹曢梻浣虹《閸撴繄绮欓幒妤佸亗闁绘棃鏅茬换鍡樸亜閺嶃劎绠撳ù婊冪秺閹粙顢涘☉姘垱闂佸搫鐭夌徊浠嬪煘閹达箑閱囨繝闈涙川娴滎亪姊绘担绛嬪殐闁哥姵鐗滅槐鐐寸節閸屾粍娈鹃梺鍓插亝濞叉牕鏁梻渚€娼чˇ顓㈠磿闁稄缍栨慨姗嗗幘缁♀偓闂佹眹鍨藉褔锝為幒妤佺厓鐟滄粓宕滈悢椋庢殾闁硅揪绠戠粻鑽ょ磽娴ｉ姘跺箯濞差亝鐓熼柣鏂挎憸閹冲啴鎮楀鐓庡箻缂佽京鍋ら獮瀣晜閻ｅ苯骞楅梻濠庡亜濞诧箑顫忛懡銈囦笉闁绘劖鎯屽▓浠嬫煟閹邦厼绲婚柡鍡愬灪閵囧嫰鏁冮埀顒傜礊婵犲洤钃?)) return; try { const res = await safeFetch(`/api/datacenters/${id}/`, { method: 'DELETE' }); if(res.ok) { refreshData(); if(activeLocation==id) setActiveLocation(null); } } catch(e){} };
  
  const handleSaveRack = async (formData) => { 
      const url = formData.id ? `/api/racks/${formData.id}/` : '/api/racks/'; 
      const method = formData.id ? 'PUT' : 'POST';
      
      const pduMeta = {
          count: safeInt(formData.pdu_count, 2),
          power: safeInt(formData.pdu_power, 0)
      };

      let cleanDesc = (formData.description || '').replace(/__PDU_META__:({.*})$/m, '').trim();
      const newDesc = cleanDesc ? `${cleanDesc}\n__PDU_META__:${JSON.stringify(pduMeta)}` : `__PDU_META__:${JSON.stringify(pduMeta)}`;

      const payload = { 
          ...formData, 
          datacenter: activeLocation,
          description: newDesc
      }; 

      delete payload.pdu_count;
      delete payload.pdu_power;
      delete payload.pdu_a_power;
      delete payload.pdu_b_power;
      
      addDebugLog(`闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愯弓鐢婚梻浣瑰濞叉牠宕愰幖浣稿瀭闁稿瞼鍋為悡鏇犳喐鎼淬劊鈧啴宕ㄧ€涙ê鈧潡鏌涢…鎴濅簴濞存粍绮撻弻鐔告綇閸撗吷戠紒缁㈠幖閻栧ジ寮诲☉銏犳閻犳亽鍓遍敐鍥╃＜缂備焦顭囩粻姘亜閿旇娅嶉柡灞剧〒閳ь剨缍嗛崑鍛暦鐏炵偓鍙忓┑鐘插暞閵囨繄鈧娲﹂崑濠傜暦閻旂⒈鏁嗗ù锝囨嚀椤忔壆绱撻崒姘偓椋庢閿熺姴绐楅柡宥庡幗閸嬪鐓崶銊р槈缂佺姵鐓￠弻鏇＄疀閺囩儐鈧本绻涚亸鏍ㄦ珚闁哄瞼鍠栧畷妤呭传閵夘喗袦濠电偛鐡ㄧ划搴ㄥ磻閹捐埖宕叉繛鎴欏灩缁狅綁鏌ｉ幇顒備粵闁革絼绮欏铏圭磼濡櫣顑傞梺绋款儐閹瑰洦淇婇悽绋跨妞ゆ牗鑹惧畵鍡涙⒑闂堟侗鐒鹃柛搴ㄤ憾閿濈偤鍩￠崨顔惧幐?[${method}]`, { url, payload }, 'info');

      try { 
          const res = await safeFetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }); 
          if(res.ok) { 
              addDebugLog('闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晜閽樺缃曢梻濠庡亜濞诧妇绮欓幋鐘差棜闁秆勵殕閻撳繘鏌涢锝囩婵℃彃缍婇弻娑氣偓锝庝簻閳ь剙娼″濠氬灳閹颁礁鎮戦梺鍛婂姂閸斿矂鈥栫€ｎ喗鈷戠€规洖娲﹂崵鈧紓浣割槺閺佹悂骞戦姀鐘斀閻庯綆鍋掑Λ鍐ㄢ攽閻愭潙鐏﹂柣鐕佸灠铻為柕鍫濐槹閳锋垿鏌涢敂璇插箺婵炲懏娲栭埞鎴︽倷閳轰椒澹曢梻鍌欑閹碱偊鎯夋總绋跨獥闁规崘顕ч悞鍨亜閹哄秷鍏岄柍顖涙礋閺屻劌顫濋鑺ユ杸濡炪倖鏌ㄩ崥瀣箹閹扮増鐓?, { status: res.status }, 'success');
              alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕ㄩ婊咃紲闂佺粯鐟ラ幊鎰矓椤曗偓閺屸€崇暆閳ь剟宕伴弽顓炶摕闁搞儺鍓氶弲婵嬫煃瑜滈崜姘跺疾閸洦鏁婂┑顔藉姃缁?); 
              setIsRackModalOpen(false); 
              refreshData(); 
          } else {
              addDebugLog('闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晜閽樺缃曢梻濠庡亜濞诧妇绮欓幋鐘差棜闁秆勵殕閻撳繘鏌涢锝囩婵℃彃缍婇弻娑氣偓锝庝簻閳ь剙娼″濠氬灳閹颁礁鎮戦梺鍛婂姂閸斿矂鈥栫€ｎ喗鈷戠€规洖娲﹂崵鈧紓浣割槺閺佹悂骞戦姀鐘斀閻庯綆鍋掑Λ鍐ㄢ攽閻愭潙鐏﹂柣鐕佸灠铻為柕鍫濐槹閳锋垿鏌涢敂璇插箺婵炲懏娲栭埞鎴︻敊閼恒儱鍞夐梺鐐藉劵缁犳挸鐣风粙璇炬棃鍩€椤掑倻涓嶆慨妯垮煐閻撴瑦绻涢崼婵堜虎闁哄鍊楃槐鎾诲醇閵夈倖鍠氶梺?, { status: res.status, text: await res.text() }, 'error');
              alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧孝缂佺粯甯￠幃鐐綇閳哄啰锛滈梺鍛婃尫缁€浣圭鏉堚斁鍋撳▓鍨灈闁绘牜鍘ч悾閿嬬附閸撳弶鏅濆銈庡亽閸樺ジ宕甸柆宥嗙厽闁绘劕顕。鑼磼鐠囪尙澧曟い顐㈢箰鐓ゆい蹇撳椤斿洭鏌熼懝鐗堝涧缂佹彃鎼嵄闁割偁鍎查埛鎴炵箾閼奸鍤欐鐐村笧缁辨帡鎳滈棃娑樻懙闂侀潧妫旂粈渚€锝炲┑鍥风矗婵犻潧娲﹀▍宀勬⒒娴ｅ憡鍟炴繛璇х畵瀹曟垶寰勯幇顒傤啈闂佸搫娲㈤崹娲煕閹达附鈷掗柛顐ゅ枎閸犳洜绱掗幉瀣瘈闁哄本鐩鎾Ω閵夈儳顔掗梻浣告惈濡參宕圭捄渚綎婵炲樊浜濋崵鎺楁煏閸繃鍟楅柕寰涢绨婚梺鐟扮摠缁诲啴宕甸崶鈹惧亾鐟欏嫭澶勯柛銊ョ埣閻涱喗鎯旈妸锕€娈熼梺闈涱槶閸庤鲸鏅堕悙顑跨箚闁绘劦浜滈埀顒佺墵閹冾煥閸繄锛涘┑鐐村灦濮樸劎浜搁悽纰樺亾楠炲灝鍔氭い锔垮嵆閹ょ疀閹垮啰鍞甸柣鐘荤細濞咃絾鏅堕弴銏＄厱闁哄倽顕ч埀顒侇殘濡?);
          }
      } catch(e){
          addDebugLog('闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晜閽樺缃曢梻濠庡亜濞诧妇绮欓幋鐘差棜闁秆勵殕閻撳繘鏌涢锝囩婵℃彃缍婇弻娑氣偓锝庝簻閳ь剙娼″濠氬灳閹颁礁鎮戦梺鍛婂姂閸斿矂鈥栫€ｎ喗鈷戠€规洖娲﹂崵鈧紓浣割槺閺佹悂骞戦姀鐘斀閻庯綆鍋掑Λ鍐ㄢ攽閻愭潙鐏﹂柣鐕佸灠铻為柕鍫濐槹閳锋垿鏌涢敂璇插箺婵炲懏娲栭埞鎴︻敊閹冨箣闂佺硶鏂侀崑鎾愁渻閵堝棗绗傜紒璁圭節瀹曨垵绠涘☉娆戝幈闂佺粯锚绾绢厽鏅堕悽纰樺亾鐟欏嫭绀冮柛鏃€鐟╅悰顕€寮介妸锕€顎撻梺鑽ゅ枛椤ｏ箓宕?, e.message, 'error');
      } 
  };

  const handleDeleteRack = async (id, e) => { e.stopPropagation(); if(!confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪妶澶婄厴闁硅揪闄勯崑鎰版倵閸︻厼孝妞ゃ儲绻勭槐鎾存媴閹绘帊澹曢梻浣虹《閸撴繄绮欓幒妤佸亗闁绘棃鏅茬换鍡樸亜閺嶃劎绠撳ù婊冪秺閹粙顢涘☉姘垱闂佸搫鐭夌徊浠嬪煘閹达箑閱囨繝闈涙川娴滎亪姊绘担绛嬪殐闁哥姵鐗滅槐鐐寸節閸屾粍娈鹃梺鍓插亝濞叉牕鏁梻渚€娼чˇ顓㈠磿闁稄缍栨慨姗嗗幘缁♀偓闂佹眹鍨藉褔锝為幒妤佺厓鐟滄粓宕滈悢椋庢殾闁硅揪绠戠粻鑽ょ磽娴ｉ姘跺箯濞差亝鈷戦柛娑橈功缁犳捇鎮楀鐓庡箹闁挎洏鍨介獮宥夘敊閸撗嶇床婵＄偑鍊栧Λ渚€宕戦幇鐗堝€块柛娑橆煬濞堜粙鏌ｉ幇顓炵祷闁哄棎鍨洪妵鍕晝閳ь剛绱炴繝鍥ц摕?)) return; try { const res = await safeFetch(`/api/racks/${id}/`, { method: 'DELETE' }); if(res.ok) { if(selectedRack?.id===id) setSelectedRack(null); refreshData(); } } catch(e){} };
  
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
          const res = await safeFetch(url, { method: deviceData.id?'PUT':'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          if(res.ok) {
              updateHistory(deviceData);
              alert('闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀缁犵娀鏌熼崜褏甯涢柛濠呭煐缁绘繈妫冨☉姘叡闂佹椿鍘介幐楣冨焵椤掑喚娼愭繛鍙夌墪鐓ら柕濞у懐鐒兼繝鐢靛Т濞诧箓鎮″☉銏＄厱闁规壋鏅涙俊鍨熆瑜庡ú婊呮閹烘鍋戦柛娑卞灣琚﹂梻浣告惈閻ジ宕伴弽顓炶摕闁搞儺鍓氶弲婵嬫煃瑜滈崜姘跺疾閸洦鏁婂┑顔藉姃缁?);
              setEditingDevice(null);
              refreshData();
          } else {
               alert('濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧孝缂佺粯甯￠幃鐐綇閳哄啰锛滈梺鍛婃尫缁€浣圭鏉堚斁鍋撳▓鍨灈闁绘牜鍘ч悾閿嬬附閸撳弶鏅濆銈庡亽閸樺ジ宕甸柆宥嗙厽?);
          }
      } catch(e) {
          alert(`缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮闁汇値鍠楅妵鍕冀椤愵澀绮堕梺鎼炲妼閸婂潡寮诲☉銏℃櫆閻犲洦褰冪粻褰掓⒑閹肩偛濡界紒璇茬墦瀵鈽夐姀鈺傛櫇闂佹寧绻傚Λ娑⑺囬妷褏纾藉ù锝呮惈椤庢挾绱撳鍕獢鐎殿喖顭烽崹楣冨箛娴ｅ憡鍊梺纭呭亹鐞涖儵鍩€椤掍礁绲婚柡瀣墦濮婄粯鎷呮笟顖滃姼缂備胶绮崝鏇犲弲闂侀潧臎閸曞灚缍楅梻浣筋潐閸庢娊鎮洪妸锕€鍨旈柟缁㈠枟閻撴洘绻濋棃娑欘棞妞ゅ浚浜弻锝嗘償閵堝懎鎯炵紓浣介哺閹稿骞忛崨顔绢浄閻庯綆浜濋幊娆撴⒒娴ｇ瓔娼愰柟顔煎€荤划濠氬冀瑜滈崵鏇熴亜閹拌泛鐦滈柡浣割儔閺屽秷顧侀柛鎾寸懆閻忓姊洪崨濠傚Е闁哥姵鐗犻幃鈥斥槈閵忥紕鍘遍梺瑙勬緲閸氣偓缂併劎鏅埀?{e.message}`);
      }
  };

  const handleDeleteDevice = async (id) => { if(!confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪妸褎顫曢柟鎯х摠婵挳鎮归崶椋庣？闁告梻鍏樺鍝勭暦閸モ晛绗″┑鈽嗗亜閸熸挳鐛崘銊庢棃宕ㄩ鑺ョ彸闂佺鍋愮悰銉╁焵椤掑啫鐨洪柡浣圭墪閳规垿鎮欏顔兼婵犳鍠氶弫濠氱嵁閸愵喖纾兼慨妯煎帶濞堛劑姊洪崜鎻掍簼婵炲弶鐗犻幃鈥斥槈閵忥紕鍘遍柣蹇曞仜婢т粙鎯岀€ｎ喗鐓曢柨娑樺船濞诧箓宕戦埄鍐瘈濠电姴鍊搁顏嗙磼鐠哄搫绾ч柕鍥у瀵挳濡搁妷銉х潉婵°倗濮烽崑娑氭崲閹烘鐒垫い鎺戯功缁夌敻鏌涢悩宕囧⒈缂侇喛顕ч～婵囨綇閵娿儲鐎炬繝鐢靛Т閿曘倝宕ュ鈧弫鎰緞鐎ｎ亙缂撻梻浣告啞缁嬫垿鏁冮敃鍌氬偍闁告鍋愰弨鑺ャ亜閺冣偓閺嬬粯绗熷☉銏＄厱婵炲棗绻橀妤呮煃缂佹ɑ宕岄柡浣瑰姍瀹曞爼鍩￠崘璺ㄥ簥?)) return; try { const res = await safeFetch(`/api/rack-devices/${id}/`, { method: 'DELETE' }); if(res.ok) { setEditingDevice(null); refreshData(); } } catch(e){} };
  const handleScanSubnet = async () => { if (!selectedSubnetId) return; if(!confirm("缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪銏犵畺鐟滅増甯掗悙濠勬喐鎼淬劌鐓濋柡鍥ュ灪閻撴洟鏌曢崼婵囶棡缂佲偓鐎ｎ喗鐓涢悘鐐垫櫕鍟稿銇卞倻绐旈柡灞剧洴楠炴﹢寮堕幋婵囨嚈婵°倗濮烽崑娑㈡偋閹剧繝绻嗘慨婵嗙焾濡茬兘姊虹粙娆惧剱闁圭懓娲顐﹀箛椤撶喎鍔呴梺鐐藉劥鐏忔瑩鎯勬惔顫箚闁绘劦浜滈埀顒佸灴瀹曟洟宕￠悘缁樻そ椤㈡﹢濮€閻樼儤鎲伴梻浣虹帛濮婂宕曢妶鍥ｅ亾濮橆厼鍝洪柡灞诲€楅崰濠囧础閻愬樊娼炬俊鐐€栭弻銊ッ洪鐑嗘綎闁惧繗顫夌€氭岸鏌嶉妷銊︾彧婵炲牜鍙冨娲箹閻愭彃濮岄梺鍛婃煥缁夋挳鍩?)) return; setIsScanning(true); try { const res = await safeFetch('/api/scan/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subnet_id: selectedSubnetId }) }); if (res.ok) { alert((await res.json()).message); refreshData(); } else { alert("闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑﹦绋忔繝銏ｅ煐閸旓箓寮繝鍥ㄧ厸鐎广儱楠搁獮鏍棯閹岀吋闁哄本绋戦埥澶愬础閻愭彃顒滈梻浣规偠閸婃牕煤閻旂厧绠栫憸鐗堝笒缁犳帡鏌熼悜妯虹仴妞ゎ剙顦甸弻锝嗘償閵忋埄鏆￠悗鍏夊亾缂佸顑欏鏍ㄧ箾瀹割喕绨婚柛銊ュ€归妵鍕即閻愭潙娅ｉ梺鍛婃尭閸熷潡鍩為幋锔藉亹妞ゆ劦婢€婢规洟姊绘担鍛婃儓妞わ缚鍗冲畷娲醇閵夛箑浜滈梺绯曞墲缁嬫帡鎮″▎鎰╀簻闁哄秲鍔庨埥澶嬨亜閵夈儺鍎戠紒杈ㄥ浮婵℃悂濡烽敃鈧禒鎾⒑鐠団€虫灈闁搞垺鐓￠崺銏℃償閳锯偓閺嬪酣鏌熺€电校婵炲牆銈稿缁樻媴閼恒儯鈧啰绱掗埀顒佹媴閾忓湱鐓嬮梺鍦檸閸犳宕戦埡鍌滅瘈闂傚牊渚楅崕蹇曠磼閳ь剟宕橀鐣屽幍濡炪倖鐗曞Λ妤冣偓姘卞厴瀹曨剟鎮烽幍铏杸闂佺粯蓱椤旀牠寮抽娑楃箚闁圭粯甯楅崵鍥┾偓瑙勬礃閸ㄥ潡宕洪埀顒併亜閹烘垵顏柣鎾存礋閹鏁愭惔鈥茬凹閻庤娲栭惌鍌炲蓟閳ュ磭鏆嗛悗锝庡墰閿涚喐绻涚€电顎撳┑鈥虫喘楠炲繘鎮╃拠鑼唽闂佸湱鍎ら崺鍫濐焽濞戙垺鈷掗柛灞剧懄缁佺増銇勯弴鐔哄⒌鐎规洘婢樿灃闁告侗鍋€閸嬫捇宕橀濂稿敹闂侀潧绻掓慨鎾倶婵犲洦鈷戦柛鎰级閹牓鏌熷畡閭﹀剶鐎殿噮鍋勯濂稿幢濞嗘埈鍟庨梻浣烘嚀椤曨參宕戦悢鐓庣疇闁告稑鐡ㄩ悡鐔兼煏閸繂鈧憡绂嶆ィ鍐┾拻闁稿本鑹鹃埀顒勵棑缁牊绗熼埀顒勭嵁婢舵劖鏅搁柣妯垮蔼閹芥洟姊虹捄銊ユ灁濠殿喖顕划鍫ュ醇閻旇櫣鐦堥梻鍌氱墛缁嬫帡鎮為悙顒傜闁瑰瓨鐟ラ悘鈺呮煟閹惧娲撮柡灞剧洴瀵挳濡搁妷銉ь啋闂備礁鎼ˇ閬嶁€﹂崼銉ョ厴闁硅揪闄勯弲顒勬煕閺囥劌浜楃紒顔肩埣濮婂搫效閸パ冾瀷闂佺绻戦敋闁?); } } catch(e){ alert("闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑﹦绋忔繝銏ｅ煐閸旓箓寮繝鍥ㄧ厸鐎广儱楠搁獮鏍棯閹岀吋闁哄本绋戦埥澶愬础閻愭彃顒滈梻浣规偠閸婃牕煤閻旂厧绠栫憸鐗堝笒缁犳帡鏌熼悜妯虹仴妞ゎ剙顦甸弻锝嗘償閵忋埄鏆￠悗鍏夊亾缂佸顑欏鏍ㄧ箾瀹割喕绨婚柛銊ュ€归妵鍕即閻愭潙娅ｉ梺鍛婃尭閸熷潡鍩為幋锔藉亹妞ゆ劦婢€婢规洟姊虹拠鍙夋崳闁轰礁鎽滃☉鐢稿醇閺囩偟锛涢梺鍦亾閺嬪ジ寮搁弮鍫熺厱妞ゎ厽鍨甸弸鐔兼煟韫囨挾澧︽慨濠呮缁瑩宕犻埄鍐╂毎闂備浇顕栭崰鏍磹閸ф宓? " + e.message); } finally { setIsScanning(false); } };
  const handleManualBackup = async () => { try { const res = await safeFetch('/api/trigger-backup/', { method: 'POST' }); const data = await res.json(); if (res.ok) { alert(`濠电姷鏁告慨鐑藉极閸涘﹥鍙忓ù鍏兼綑閸ㄥ倿鏌ｉ幘宕囧哺闁哄鐗楃换娑㈠箣閻愨晜锛堝┑鐐叉▕娴滄繈寮查幓鎺濈唵閻犺櫣灏ㄦΛ姘舵煕閳哄啫浠辨慨濠冩そ濡啫鈽夊顒夋毇婵＄偑鍊х€靛矂宕瑰畷鍥у灊濠电姵纰嶉弲鎻掝熆鐠轰警鍎戦柛妯兼暬濮婄粯绗熼崶褍浼庣紓浣哄У閸ㄥ爼寮查崼鏇ㄦ晩濠殿喗鍔掔花璇差渻閵堝棗濮傞柛濠冩礋閸┿垽宕奸妷锔惧幐?{data.filename}`); refreshData(); } } catch(e){} };
  const handleDownloadBackup = (filename) => {
    if (!filename) return;
    window.open(`/api/backup/download/?filename=${encodeURIComponent(filename)}`, '_blank');
  };
  const handleBlockIP = async () => { if(!blockFormData.ip_address) return alert('闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃繘骞戦姀銈呯疀妞ゆ棁妫勬惔濠囨煟鎼搭垳绉甸柛鐘愁殜瀹曠敻宕熼娑氬幈濡炪倖鍔х徊鍓у閹间焦鐓?IP 濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙缂佺姳鍗抽弻娑樷攽閸曨偄濮㈤梺娲诲幗閹瑰洭寮婚敐澶婄闁挎繂妫Λ鍕磽娴ｆ彃浜鹃梺绋挎湰缁嬫劗鎹㈤崱妯镐簻闁哄秲鍔庣粻鎾绘煕濮橆剛绉洪柡灞界Ф缁辨帒螣濞茬粯顥堥梻浣告惈閻瑩宕卞▎鎴炴緫闂備浇顫夐崕鎶藉疮閹稿孩缍囬柛娑樼摠閳?); try { const res = await safeFetch('/api/blocklist/', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(blockFormData) }); if(res.ok) { alert('闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃繘骞戦姀銈呯疀妞ゆ棁妫勬惔濠囨煟鎼搭垳绉甸柛鐘愁殜瀹曠敻宕熼娑氬幈濡炪倖鍔х徊鍓у閹间焦鐓冪憸婊堝礈濞嗘挸绠犳慨妞诲亾鐎殿噮鍋婂畷姗€顢欓懖鈺嬬床婵犳鍠楅敃銏㈡兜閹间礁瑙﹂柛娑樼摠閳锋帒霉閿濆懏鎲哥紒澶嬫そ閺屾稓鈧綆浜烽煬顒傗偓瑙勬礃缁矂鍩㈡惔銊ョ闁告洦鍘鹃埣?); setIsBlockModalOpen(false); refreshData(); } } catch(e) {} };
  const handleUnblockIP = async (id) => { if(confirm('缂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礃閹偤骞栧ǎ顒€濡奸柣顓燁殜楠炴牕菐椤掆偓婵¤偐绱掗幇顓ф畷缂佺粯鐩獮瀣枎韫囨洖濮堕梻浣芥〃缁€浣该洪銏犺摕闁靛牆妫欓崣蹇涙煙闁箑鍘撮柛瀣崌瀵粙顢橀悙鐢靛炊闂備胶纭堕崜婵堢矙閹烘鍋傞柕澶涘缁♀偓闂傚倸鐗婄粙鎺椝夐悙鐑樼厱闁挎繂鐗嗚缂備胶绮惄顖氱暦婵傜唯闁靛牆妫楅弸銈夋煟鎼淬埄鍟忛柛鐘崇墵閹儲绺界粙鎸庢К闂佽法鍠撴慨瀵稿閸忚偐绡€濠电姴鍊搁鈺傜箾閸涱厾绠绘慨濠傤煼瀹曟帒鈻庨幋顓熜滈柣搴㈩問閸犳牗鏅舵惔銊ョ闁圭儤顨呯粻鑽も偓瑙勬礀濞诧箑鈻撴ィ鍐┾拺缂備焦锚閻忚鲸淇婇銏狀伀闁汇儺浜ｉˇ褰掓煛瀹€鈧崰鎾跺垝濞嗘挸绠伴幖娣灩闂傤垳绱撻崒娆愵樂闁煎啿鐖煎畷妤€螣娓氼垱缍庡┑鐐叉▕娴滄粌顔忓┑鍡忔斀闁绘ɑ褰冮鎾煛閸″繆鍋撻幇浣瑰瘜闂侀潧鐗嗛崯顐ｄ繆娴犲鐓曢柡鍐ｅ亾妞ゃ劌鎳庡畵?)) { try { const res = await safeFetch(`/api/blocklist/${id}/`, { method: 'DELETE' }); if(res.ok) refreshData(); } catch(e) {} } };
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
      return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">婵犵數濮烽弫鍛婃叏閻㈠壊鏁婇柡宥庡幖缁愭淇婇妶鍛殲鐎规洘鐓￠弻鐔兼焽閿曗偓閺嬫稓绱掗煬鎻掆偓婵嬪蓟閿曗偓铻ｅ〒姘煎灡椤庡棝姊洪懖鈺侇暭閻庣瑳鍥﹂柛鏇ㄥ枤閻も偓闂佸湱鍋撳娆擃敁濞戞ǚ鏀介柣鎰皺婢с垽鏌￠崪浣镐喊闁糕斁鍋撳銈嗗坊閸嬫捇鏌涘Ο鑽ょ煉鐎规洘鍨块獮妯肩磼濡厧骞堥梻浣筋潐濠㈡﹢宕ラ埀顒傜磼閵娿儱鎮戦柕鍥у椤㈡洟濮€閳跺灕鍕弿濠电姴鎳忛鐘绘煙婵傚浜濋柟顖涙閸╁嫰宕樼捄銊ь槸闂傚倷鐒﹂幃鍫曞磹閺嶎厽鍋＄憸蹇撐ｉ幇鏉跨闁归绀侀幃鎴︽⒑閸涘﹣绶遍柛銊ョХ椤﹀綊鏌″畝鈧崰鏍€佸▎鎴炲枂闁告洦鍓涜ぐ瀣⒒娴ｄ警鏀版繛鍛礈閸掓帗鎯旈妸銉х崶婵犵數濮存导锝夋偄閸涘﹤顫￠梺鍝勵槹椤戞瑥螞?..</div>;
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
            activeLabel={TAB_CONFIG[activeTab]?.label || '闂傚倸鍊搁崐宄懊归崶褏鏆﹂柛顭戝亝閸欏繒鈧箍鍎遍ˇ顖滅矆閸愨斂浜滄い鎾跺枎閻忥綁寮堕埡鍋亪鍩為幋鐐茬疇闂佺锕ラ〃鍡涘箞閵娾晛绾ч柟鐐藉妽濡炶姤淇婂宀婃Щ闂佹悶鍔嶇换鍌炲煘閹达附鍋愮€规洖娴傞弳锟犳⒑閸濆嫭濯奸柛鎾跺枛瀵鈽夐姀鐘插祮闂侀潧顭堥崕閬嶏綖閳哄懏鈷戦梺顐ゅ仜閼活垱鏅舵导瀛樼厱閻庯綆鍓欓弸娑㈡煕閳规儳浜炬俊鐐€栫敮鎺楀窗濮橆剦鐒介柟鎵閻撴瑦銇勯弮鍥т汗闁糕晪绲块埀顒冾潐濞叉ê煤閻旇偐宓佺€广儱顦介弫濠囨煕閹炬鏈瑧闂傚倸鍊风粈渚€骞栭锕€鐤い鎰堕檮閸嬪鏌涢埄鍐姇闁?}
            currentUser={currentUserDisplay}
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

      {/* --- 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸ゅ嫰鏌涢锝嗙５闁逞屽墾缁犳挸鐣锋總绋款潊闁炽儱鍟跨花銉╂⒒娴ｇ顥忛柛瀣╃窔瀹曟洘娼忛埡鍐劶婵犮垼娉涙径鍥磻閹捐绀傚璺猴梗婢规洟姊绘担鍛婂暈婵炶绠撳畷婊冣枎閹惧磭顦梺鍛婂姇濡﹤銆掓繝姘厪闁割偅绻冮ˉ婊堟煕瑜嶉敃顏堝蓟濞戞埃鍋撻敐搴′簼鐎规洖鐭傞弻鐔兼寠婢跺苯鐓熼梺杞扮劍閸旀牕顕ラ崟顓涘亾閿濆骸澧悽顖涱殜濮婄粯鎷呴崫銉︾€┑鈩冦仠閸斿海鍒掗崼鐔虹懝闁逞屽墮椤曪綁鎼归銈囩槇闂佹悶鍎崝搴ㄥ储闁秵鐓熼幖鎼灣缁夌敻鏌涚€ｎ亝鍣藉ù婊冩啞鐎佃偐鈧稒顭囬崢鐢告倵閻熸澘顏褎顨婂畷铏鐎ｎ偆鍘垫俊鐐差儏妤犳悂鍩㈤崼銉︾厱闁宠桨绀侀顓犫偓瑙勬礃閿曘垽宕洪敓鐘茬＜婵炴垵宕弲鐘绘⒒閸屾艾鈧悂宕愬畡鎳婂綊宕堕澶嬫櫔閻熸粌绉归敐鐐测攽鐎ｎ偅娅囬梺绋跨焿婵″洨绮欒箛鏃傜瘈闁靛骏绲介悡鎰版煕閺冣偓閻楃姴鐣烽弴鐐嶆梹鎷呴崗鍝ョ泿闂備礁鎼崐鎼佹倶濠靛鐓曢柡鍌氱氨濡?(Modals) --- */}
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

      {/* 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋為悧鐘汇€侀弴銏℃櫇闁逞屽墰婢规洝銇愰幒鎾跺幗闂佺粯姊婚崢褎绂嶆导瀛樼厽闁哄倹瀵чˉ鐐烘煙娓氬灝濡兼い顏勫暟閹风娀鐓鐑嗘闂備浇宕垫慨宕囨媰閿曞倸鍨傞柛顐ｆ礀閽冪喐绻涢幋娆忕仼缂佺姵鐩濠氬醇閻旇　濮囬梺璇茬箰缁夌懓顫忓ú顏勪紶闁告洦鍓欓娑㈡⒑閸涘﹥灏扮€光偓閹间胶宓侀柛顐犲劚鎯熼梺闈涱樈閸犳顕欏ú顏呪拺缂侇垱娲栨晶鍙夈亜閵娿儲鍤囬柛鈺傜洴楠炴帒螖娴ｅ弶瀚奸梻浣侯攰閸嬫劙宕戝☉銏犵劦妞ゆ帊绀侀悘瀵糕偓瑙勬礃閸旀洟鍩為幋鐘亾閿濆簼娴烽柟鑺ユ礀閳规垿鎮欓弶鎴犱桓缂備緡鍠栭柊锝夊箖閸ф鐒垫い鎺戝閻撶喖骞栭幖顓炵仯缂佸娼ч湁婵犲﹤瀚惌瀣煙娓氬灝濡介柟顖涙婵℃悂鏁傜憴鍕伖闂備浇宕垫慨鏉懨洪悩璇茬劦妞ゆ帒鍟悵顏堟煟韫囨挾肖缂佽鲸鎸荤粭鐔煎炊瑜庨悘鍫ユ⒒娴ｇ绨荤紓宥勭閻ｅ嘲煤椤忓嫮鍔?Modal */}
      {importWizardOpen && pendingFile && (
        <ImportWizardModal 
          file={pendingFile} 
          onClose={() => { setImportWizardOpen(false); setPendingFile(null); }}
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
      {/* 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊瑜忛弳锕傛煕椤垵浜濋柛娆忕箻閺岀喓绱掗姀鐘崇彯闂佽桨绀佺€氫即寮诲☉妯锋婵炲棙鍔楃粙鍥⒑濮瑰洤鈧倝宕抽敐澶婅摕闁绘梻鍘х粻姘舵煛婢跺﹥娅囬柟鍓х帛閻撴洟骞栫划瑙勵潐闁衡偓婵犳碍鐓忛柛銉戝喚浼冮悗娈垮枙缁瑩銆侀弴顫稏妞ゆ挾濮靛畷鐔虹磽閸屾艾鈧娆㈤敓鐘茬；闁告洦鍘鹃惌鎾舵喐閻楀牆绗掗柦鍐枛閺岋繝宕堕埡浣圭€荤紓浣稿閸嬨倝寮诲☉銏╂晝闁挎繂娲ㄩ悾鍨節濞堝灝鏋旈柛銊ㄥ吹濡叉劙骞樼€涙ê顎撻梺鍛婄箓鐎氬懘濮€閻欌偓閻斿棛鎲稿澶嬬厐闁挎繂顦弰銉╂煃瑜滈崜姘跺Φ閸曨垰绠崇€广儱娲╃粣妤呮⒑閸濄儱鏋庣紒缁橈耿瀵鈽夐姀鈥充汗閻庤娲栧ú銈夊焻瑜版帗鈷戦柟绋垮绾炬悂鏌涢妸銈囩煓鐎殿喖顭峰畷鍗炍旀繝鍌涘€梻浣虹《閸撴繈濡甸悙闈涘灊?*/}
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