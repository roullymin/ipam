import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  Clock3,
  MapPin,
  Server,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';

import {
  DashboardAdvicePanel,
  DashboardDatacenterHeatPanel,
  DashboardHero,
  DashboardPriorityCards,
  DashboardQuickActions,
  DashboardRecentActivityPanel,
  DashboardVersionStatusPanel,
} from '../components';
import { BRAND } from '../../../lib/brand';

const ROLE_HOME_CONFIG = {
  admin: {
    title: '把风险、容量和版本状态放在同一页里。',
    description: '先处理异常、待审流程和发布健康度，再决定今天要推进的工作。',
    quickActions: [
      { label: '打开安全中心', target: { tab: 'security' } },
      { label: '查看待审批变更', target: { tab: 'changes' } },
      { label: '管理系统用户', target: { tab: 'users' } },
    ],
  },
  dc_operator: {
    title: '先看站点压力，再处理设备和变更。',
    description: '把热点机房、待执行变更和驻场协同放到同一个控制面板里。',
    quickActions: [
      { label: '打开机房视图', target: { tab: 'dcim' } },
      { label: '查看待执行变更', target: { tab: 'changes' } },
      { label: '查看驻场待审核', target: { tab: 'resident', residentFilters: { approvalStatus: 'pending' } } },
    ],
  },
  ip_manager: {
    title: '地址利用率和异常地址要直接落到台账里。',
    description: '首页保留最关键的指标，再用快捷入口进入可操作的地址列表。',
    quickActions: [
      { label: '打开地址台账', target: { tab: 'list' } },
      { label: '查看安全告警', target: { tab: 'security' } },
      { label: '检查备份摘要', target: { tab: 'backup' } },
    ],
  },
  auditor: {
    title: '把登录、安全和流程状态串成一条时间线。',
    description: '优先关注高风险行为、待审批流程和最近的系统动作。',
    quickActions: [
      { label: '打开安全中心', target: { tab: 'security' } },
      { label: '查看设备变更', target: { tab: 'changes' } },
      { label: '查看驻场审批', target: { tab: 'resident', residentFilters: { approvalStatus: 'pending' } } },
    ],
  },
  guest: {
    title: '先理解当前环境，再决定要深入哪个模块。',
    description: '这里保留站点热度、容量指标和基础健康摘要，方便只读查看。',
    quickActions: [
      { label: '查看地址台账', target: { tab: 'list' } },
      { label: '查看机房概览', target: { tab: 'dcim' } },
    ],
  },
};

const safeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return value;
  }
};

const formatActionLabel = (log) => {
  const actionMap = { login: '登录系统', logout: '退出系统' };
  return actionMap[log?.action] || log?.action || '系统操作';
};

export default function DashboardView({
  datacenters,
  racks,
  rackDevices,
  ips,
  logs,
  residentStaff = [],
  onJumpToDc,
  onNavigate,
  overview = null,
  lastRefreshedAt = '',
  currentRole = 'guest',
  currentUserDisplay = '',
  currentPermissions = [],
}) {
  const roleConfig = ROLE_HOME_CONFIG[currentRole] || ROLE_HOME_CONFIG.guest;
  const canAccessTab = (tab) => !tab || currentPermissions.includes(tab);

  const dashboard = useMemo(() => {
    const rackMap = new Map(racks.map((rack) => [String(rack.id), rack]));
    const totalAssets = rackDevices.length;
    const totalIPs = ips.length;
    const activeIPs = ips.filter((item) => ['online', 'active'].includes(item.status)).length;
    const ipUsageRate = totalIPs ? clampPercent((activeIPs / totalIPs) * 100) : 0;
    const totalPower = racks.reduce((sum, rack) => sum + safeInt(rack.pdu_power, 0), 0);
    const totalRackU = racks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
    const usedRackU = rackDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
    const rackUsageRate = totalRackU ? clampPercent((usedRackU / totalRackU) * 100) : 0;

    const warningDevices = rackDevices.filter((device) => ['offline', 'maintenance'].includes(device.status));
    const residentPending = residentStaff.filter((item) => item.approval_status === 'pending');
    const residentApproved = residentStaff.filter((item) => item.approval_status === 'approved');
    const residentSeatsTodo = residentStaff.filter((item) => item.needs_seat && !item.seat_number);
    const residentExpiring = residentApproved.filter((item) => {
      if (!item.end_date) return false;
      const delta = Math.ceil((new Date(item.end_date) - new Date()) / (1000 * 60 * 60 * 24));
      return delta >= 0 && delta <= 7;
    });
    const failedLogins = logs.filter((log) => String(log.status || '').toLowerCase() !== 'success');

    const locationStats = datacenters
      .map((datacenter) => {
        const dcRacks = racks.filter((rack) => String(rack.datacenter) === String(datacenter.id));
        const rackIds = dcRacks.map((rack) => String(rack.id));
        const dcDevices = rackDevices.filter((device) => rackIds.includes(String(device.rack)));
        const dcTotalU = dcRacks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
        const dcUsedU = dcDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
        return {
          ...datacenter,
          rackCount: dcRacks.length,
          deviceCount: dcDevices.length,
          warningCount: dcDevices.filter((device) => ['offline', 'maintenance'].includes(device.status)).length,
          uUtilization: dcTotalU ? clampPercent((dcUsedU / dcTotalU) * 100) : 0,
          powerLoad: dcRacks.reduce((sum, rack) => sum + safeInt(rack.pdu_power, 0), 0),
          riskIndex: dcDevices.length + dcUsedU,
        };
      })
      .sort((a, b) => b.riskIndex - a.riskIndex);

    const topDatacenter = locationStats[0] || null;
    const firstWarningRack = warningDevices[0] ? rackMap.get(String(warningDevices[0].rack)) : null;

    return {
      totalAssets,
      totalIPs,
      activeIPs,
      ipUsageRate,
      totalPower,
      rackUsageRate,
      usedRackU,
      totalRackU,
      warningDevices: warningDevices.length,
      residentPending: residentPending.length,
      residentApproved: residentApproved.length,
      residentExpiring: residentExpiring.length,
      residentSeatsTodo: residentSeatsTodo.length,
      recentFailedLogins: failedLogins.length,
      topDatacenter,
      locationStats,
      firstWarningTarget: firstWarningRack
        ? { tab: 'dcim', datacenterId: firstWarningRack.datacenter, rackId: firstWarningRack.id }
        : { tab: 'dcim' },
    };
  }, [datacenters, ips, logs, rackDevices, racks, residentStaff]);

  const actionCards = [
    {
      title: '待审核驻场',
      value: dashboard.residentPending,
      helper: '优先完成审批和工位安排。',
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
      icon: Users,
      target: { tab: 'resident', residentFilters: { approvalStatus: 'pending' } },
    },
    {
      title: '异常设备',
      value: dashboard.warningDevices,
      helper: '离线或维护中的设备需要确认。',
      tone: 'border-rose-200 bg-rose-50 text-rose-800',
      icon: AlertTriangle,
      target: dashboard.firstWarningTarget,
    },
    {
      title: '登录异常',
      value: dashboard.recentFailedLogins,
      helper: '优先查看近期失败或锁定登录。',
      tone: 'border-slate-200 bg-slate-50 text-slate-800',
      icon: ShieldCheck,
      target: { tab: 'security' },
    },
  ];

  const visibleQuickActions = roleConfig.quickActions.filter((action) => canAccessTab(action.target?.tab));
  const visibleActionCards = actionCards.filter((item) => canAccessTab(item.target?.tab));
  const canOpenSecurity = canAccessTab('security');
  const canOpenResident = canAccessTab('resident');

  const heroMetricBadges = [
    {
      icon: AlertTriangle,
      label: '待处理事项',
      value: dashboard.warningDevices + dashboard.residentPending + dashboard.recentFailedLogins,
      onClick: canOpenSecurity ? () => onNavigate?.({ tab: 'security' }) : undefined,
    },
    {
      icon: Clock3,
      label: '本周到期驻场',
      value: dashboard.residentExpiring,
      onClick: canOpenResident ? () => onNavigate?.({ tab: 'resident' }) : undefined,
    },
    {
      icon: MapPin,
      label: '热点站点',
      value: dashboard.topDatacenter?.name || '暂无',
      onClick: () => dashboard.topDatacenter && onJumpToDc?.(dashboard.topDatacenter.id),
    },
  ];

  const heroSummaryTiles = [
    { icon: Server, label: '纳管设备', value: dashboard.totalAssets, helper: `${dashboard.warningDevices} 台需关注` },
    { icon: Activity, label: '地址活跃率', value: `${dashboard.ipUsageRate}%`, helper: `${dashboard.activeIPs} / ${dashboard.totalIPs} 地址在线` },
    { icon: Box, label: '机柜占用', value: `${dashboard.rackUsageRate}%`, helper: `${dashboard.usedRackU} / ${dashboard.totalRackU} U 已使用` },
    { icon: Zap, label: '总功率', value: `${(dashboard.totalPower / 1000).toFixed(1)} kW`, helper: '按机柜 PDU 功率汇总' },
  ];

  const adviceItems = [
    canAccessTab(currentRole === 'auditor' ? 'security' : 'resident')
      ? {
          title: '优先处理审批与异常',
          body: `当前有 ${dashboard.residentPending} 条待审核驻场、${dashboard.warningDevices} 台异常设备、${dashboard.recentFailedLogins} 条近期登录异常。`,
          onClick: () => onNavigate?.({ tab: currentRole === 'auditor' ? 'security' : 'resident' }),
        }
      : null,
    canAccessTab(currentRole === 'ip_manager' ? 'list' : 'dcim')
      ? {
          title: '关注容量与空间',
          body: `IP 活跃率 ${dashboard.ipUsageRate}%，机柜空间占用 ${dashboard.rackUsageRate}%，热点站点为 ${dashboard.topDatacenter?.name || '暂无'}。`,
          onClick: () => onNavigate?.({ tab: currentRole === 'ip_manager' ? 'list' : 'dcim' }),
        }
      : null,
    canOpenResident
      ? {
          title: '巩固驻场与工位数据',
          body: `当前已通过驻场 ${dashboard.residentApproved} 人，待安排座位 ${dashboard.residentSeatsTodo} 人，本周到期 ${dashboard.residentExpiring} 人。`,
          onClick: () => onNavigate?.({ tab: 'resident' }),
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardHero
          eyebrow={BRAND.navigation.dashboard}
          title={roleConfig.title}
          description={roleConfig.description}
          metricBadges={heroMetricBadges}
          summaryTiles={heroSummaryTiles}
        />

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <DashboardQuickActions
            title={`${currentUserDisplay || '当前用户'} 的快捷入口`}
            subtitle="卡片直接带你进入对应工作区，而不是只停留在统计层。"
            actions={visibleQuickActions}
            onNavigate={onNavigate}
          />
          <DashboardPriorityCards items={visibleActionCards} onNavigate={onNavigate} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
          <DashboardDatacenterHeatPanel datacenters={dashboard.locationStats} onJumpToDc={onJumpToDc} />
          <DashboardRecentActivityPanel
            logs={logs}
            formatActionLabel={formatActionLabel}
            formatDateTime={formatDateTime}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <DashboardAdvicePanel items={adviceItems} />
          <DashboardVersionStatusPanel
            overview={overview}
            lastRefreshedAt={lastRefreshedAt}
            formatDateTime={formatDateTime}
            onOpenSystemStatus={() => onNavigate?.({ openSystemStatus: true })}
          />
        </section>
      </div>
    </div>
  );
}
