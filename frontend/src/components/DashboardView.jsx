import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MapPin,
  Server,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { BRAND } from '../lib/brand';
import { BUILD_INFO, shortCommitLabel } from '../lib/buildInfo';


const safeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const formatActionLabel = (log) => {
  if (!log) return '系统操作';
  const actionMap = {
    login: '登录系统',
    logout: '退出系统',
  };
  return actionMap[log.action] || log.action || '系统操作';
};

const getTimelineTone = (statusValue) => {
  const status = String(statusValue || '').toLowerCase();
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'locked' || status === 'inactive') return 'bg-amber-500';
  return 'bg-rose-500';
};

const getHealthTone = (value, warningThreshold, dangerThreshold) => {
  if (value >= dangerThreshold) {
    return 'text-rose-700 bg-rose-50 border-rose-200';
  }
  if (value >= warningThreshold) {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
};

export default function DashboardView({
  datacenters,
  racks,
  rackDevices,
  ips,
  logs,
  residentStaff = [],
  onJumpToDc,
  overview = null,
  lastRefreshedAt = '',
}) {
  const dashboard = useMemo(() => {
    const totalAssets = rackDevices.length;
    const totalIPs = ips.length;
    const activeIPs = ips.filter((item) => item.status === 'online' || item.status === 'active').length;
    const ipUsageRate = totalIPs > 0 ? clampPercent((activeIPs / totalIPs) * 100) : 0;
    const totalPower = racks.reduce((sum, rack) => sum + safeInt(rack.pdu_power, 0), 0);

    const offlineDevices = rackDevices.filter((device) => device.status === 'offline');
    const maintenanceDevices = rackDevices.filter((device) => device.status === 'maintenance');
    const warningDevices = offlineDevices.length + maintenanceDevices.length;
    const healthyAssets = rackDevices.filter((device) => device.status === 'active').length;
    const assetHealthyRate = totalAssets > 0 ? clampPercent((healthyAssets / totalAssets) * 100) : 0;

    const totalRackU = racks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
    const usedRackU = rackDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
    const rackUsageRate = totalRackU > 0 ? clampPercent((usedRackU / totalRackU) * 100) : 0;

    const residentApproved = residentStaff.filter((item) => item.approval_status === 'approved');
    const residentPending = residentStaff.filter((item) => item.approval_status === 'pending');
    const residentExpiring = residentApproved.filter((item) => {
      if (!item.end_date) return false;
      const delta = Math.ceil((new Date(item.end_date) - new Date()) / (1000 * 60 * 60 * 24));
      return delta >= 0 && delta <= 7;
    });
    const residentSeatsTodo = residentStaff.filter((item) => item.needs_seat && !item.seat_number);
    const residentCoverageRate = residentStaff.length > 0
      ? clampPercent((residentApproved.length / residentStaff.length) * 100)
      : 100;

    const failedLogins = logs.filter((log) => String(log.status || '').toLowerCase() !== 'success');
    const recentFailedLogins = failedLogins.slice(0, 5).length;

    const locationStats = datacenters
      .map((datacenter) => {
        const dcRacks = racks.filter((rack) => String(rack.datacenter) === String(datacenter.id));
        const rackIds = dcRacks.map((rack) => String(rack.id));
        const dcDevices = rackDevices.filter((device) => rackIds.includes(String(device.rack)));
        const dcTotalU = dcRacks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
        const dcUsedU = dcDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
        const warningCount = dcDevices.filter(
          (device) => device.status === 'offline' || device.status === 'maintenance'
        ).length;

        return {
          ...datacenter,
          rackCount: dcRacks.length,
          deviceCount: dcDevices.length,
          warningCount,
          serverCount: dcDevices.filter(
            (device) => device.device_type === 'server' || device.device_type === 'vm'
          ).length,
          networkCount: dcDevices.filter(
            (device) =>
              device.device_type?.startsWith('switch') ||
              device.device_type === 'router' ||
              device.device_type === 'firewall'
          ).length,
          powerLoad: dcRacks.reduce((sum, rack) => sum + safeInt(rack.pdu_power, 0), 0),
          uUtilization: dcTotalU > 0 ? clampPercent((dcUsedU / dcTotalU) * 100) : 0,
          riskIndex: warningCount * 10 + (dcTotalU > 0 ? clampPercent((dcUsedU / dcTotalU) * 100) : 0),
        };
      })
      .sort((a, b) => b.riskIndex - a.riskIndex);

    const topDatacenter = locationStats[0] || null;

    const focusCards = [
      {
        key: 'pending-approval',
        title: '待审核驻场',
        value: residentPending.length,
        helper: '优先完成审批与签批导出',
        tone: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: ClipboardCheck,
      },
      {
        key: 'device-risk',
        title: '设备异常',
        value: warningDevices,
        helper: '离线或维护中的设备需要确认',
        tone: 'border-rose-200 bg-rose-50 text-rose-800',
        icon: AlertTriangle,
      },
      {
        key: 'expiring-resident',
        title: '7 天内到期',
        value: residentExpiring.length,
        helper: '需要续期或离场确认',
        tone: 'border-cyan-200 bg-cyan-50 text-cyan-800',
        icon: Users,
      },
      {
        key: 'login-exception',
        title: '登录异常',
        value: recentFailedLogins,
        helper: '关注最近失败、锁定或停用记录',
        tone: 'border-slate-200 bg-slate-50 text-slate-800',
        icon: ShieldCheck,
      },
    ];

    const pressureItems = [
      {
        label: 'IP 地址活跃率',
        value: `${ipUsageRate}%`,
        percent: ipUsageRate,
        tone: 'from-cyan-500 to-sky-500',
      },
      {
        label: '机柜空间占用',
        value: `${rackUsageRate}%`,
        percent: rackUsageRate,
        tone: 'from-indigo-500 to-cyan-500',
      },
      {
        label: '设备健康度',
        value: `${assetHealthyRate}%`,
        percent: assetHealthyRate,
        tone: 'from-emerald-500 to-teal-500',
      },
      {
        label: '驻场审批覆盖',
        value: `${residentCoverageRate}%`,
        percent: residentCoverageRate,
        tone: 'from-amber-500 to-orange-500',
      },
    ];

    return {
      totalAssets,
      totalIPs,
      activeIPs,
      ipUsageRate,
      totalPower,
      warningDevices,
      offlineDevices: offlineDevices.length,
      maintenanceDevices: maintenanceDevices.length,
      totalRackU,
      usedRackU,
      rackUsageRate,
      residentApproved: residentApproved.length,
      residentPending: residentPending.length,
      residentExpiring: residentExpiring.length,
      residentSeatsTodo: residentSeatsTodo.length,
      residentCoverageRate,
      recentFailedLogins,
      topDatacenter,
      locationStats,
      focusCards,
      pressureItems,
    };
  }, [datacenters, racks, rackDevices, ips, logs, residentStaff]);

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(135deg,#071828_0%,#0b2136_52%,#0d3554_100%)] shadow-[0_30px_65px_rgba(8,24,43,0.18)]">
          <div className="grid gap-6 px-6 py-7 md:px-8 md:py-8 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center rounded-full border border-cyan-300/16 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                  {BRAND.navigation.dashboard}
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                  今天最需要处理的，不该藏在表格里。
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/82 md:text-base">
                  这里把网络地址、机房设备、驻场审批和登录异常压缩成一张可执行的运维驾驶舱视图，让你先看风险，再看规模。
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <HeroChip
                    icon={AlertTriangle}
                    label="待关注事项"
                    value={dashboard.warningDevices + dashboard.residentPending + dashboard.recentFailedLogins}
                    tone="text-rose-100 bg-rose-400/10 border-rose-300/14"
                  />
                  <HeroChip
                    icon={Clock3}
                    label="本周到期驻场"
                    value={dashboard.residentExpiring}
                    tone="text-amber-100 bg-amber-300/10 border-amber-200/14"
                  />
                  <HeroChip
                    icon={CheckCircle2}
                    label="机房热点站点"
                    value={dashboard.topDatacenter?.name || '暂无'}
                    tone="text-cyan-100 bg-cyan-300/10 border-cyan-200/14"
                  />
                </div>

                {dashboard.topDatacenter && (
                  <button
                    onClick={() => onJumpToDc(dashboard.topDatacenter.id)}
                    className="mt-6 inline-flex items-center rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/12"
                    type="button"
                  >
                    打开热点站点 {dashboard.topDatacenter.name}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <HeroMetric
                title="纳管设备"
                value={dashboard.totalAssets}
                helper={`${dashboard.offlineDevices} 离线 · ${dashboard.maintenanceDevices} 维护`}
                icon={Server}
                accent="from-cyan-500 to-sky-500"
              />
              <HeroMetric
                title="地址活跃率"
                value={`${dashboard.ipUsageRate}%`}
                helper={`${dashboard.activeIPs} / ${dashboard.totalIPs} 地址在线`}
                icon={Activity}
                accent="from-emerald-500 to-teal-500"
              />
              <HeroMetric
                title="机柜占用"
                value={`${dashboard.rackUsageRate}%`}
                helper={`${dashboard.usedRackU} / ${dashboard.totalRackU || 0} U 已使用`}
                icon={Box}
                accent="from-indigo-500 to-cyan-500"
              />
              <HeroMetric
                title="实测功耗"
                value={`${(dashboard.totalPower / 1000).toFixed(1)} kW`}
                helper="按机柜 PDU 汇总"
                icon={Zap}
                accent="from-amber-500 to-orange-500"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.focusCards.map((item) => (
            <FocusCard
              key={item.key}
              title={item.title}
              value={item.value}
              helper={item.helper}
              tone={item.tone}
              icon={item.icon}
            />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <PanelCard
            title="资源态势"
            subtitle="把地址、机柜、设备与驻场审批压成可执行的运营压力条。"
            icon={TrendingUp}
          >
            <div className="space-y-5">
              {dashboard.pressureItems.map((item) => (
                <ProgressRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  percent={item.percent}
                  tone={item.tone}
                />
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SignalCard
                title="当前在场"
                value={dashboard.residentApproved}
                helper="已通过审核的驻场人员"
                tone="text-emerald-700 bg-emerald-50 border-emerald-200"
              />
              <SignalCard
                title="待安排座位"
                value={dashboard.residentSeatsTodo}
                helper="需要补齐办公位置或座位号"
                tone="text-cyan-700 bg-cyan-50 border-cyan-200"
              />
            </div>
          </PanelCard>

          <PanelCard
            title="运行时间线"
            subtitle="最近登录与安全动作应该读起来像一条运维时间线，而不是孤立日志。"
            icon={Clock3}
          >
            <div className="space-y-3">
              {logs.slice(0, 6).map((log) => (
                <TimelineItem key={log.id} log={log} />
              ))}
              {logs.length === 0 && (
                <EmptyMessage text="暂无最近活动，后续登录、退出和异常记录会在这里汇总显示。" />
              )}
            </div>
          </PanelCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <PanelCard
            title="站点热度"
            subtitle="优先把高风险或高占用的站点顶上来，点开即可跳转到机房设备视图。"
            icon={MapPin}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.locationStats.map((datacenter) => (
                <DatacenterCard
                  key={datacenter.id}
                  datacenter={datacenter}
                  onJump={() => onJumpToDc(datacenter.id)}
                />
              ))}
              {dashboard.locationStats.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyMessage text="还没有机房站点数据。添加机房和机柜后，这里会展示热点站点和空间负载。" />
                </div>
              )}
            </div>
          </PanelCard>

          <PanelCard
            title="运营建议"
            subtitle="把当前状态翻译成一组更接近行动的建议，而不是只展示数字。"
            icon={ShieldCheck}
          >
            <div className="space-y-4">
              <RecommendationItem
                title="优先处理审批与异常"
                body={`目前有 ${dashboard.residentPending} 条待审核驻场、${dashboard.warningDevices} 台异常设备、${dashboard.recentFailedLogins} 条近期登录异常。`}
                tone={getHealthTone(
                  dashboard.residentPending + dashboard.warningDevices + dashboard.recentFailedLogins,
                  1,
                  4
                )}
              />
              <RecommendationItem
                title="关注容量与空间"
                body={`IP 活跃率 ${dashboard.ipUsageRate}% ，机柜空间占用 ${dashboard.rackUsageRate}% ，热点站点为 ${dashboard.topDatacenter?.name || '暂无'}。`}
                tone={getHealthTone(Math.max(dashboard.ipUsageRate, dashboard.rackUsageRate), 60, 80)}
              />
              <RecommendationItem
                title="巩固人员与工位数据"
                body={`当前已通过驻场 ${dashboard.residentApproved} 人，待安排座位 ${dashboard.residentSeatsTodo} 人，本周到期 ${dashboard.residentExpiring} 人。`}
                tone={getHealthTone(
                  dashboard.residentExpiring + dashboard.residentSeatsTodo,
                  1,
                  3
                )}
              />
            </div>
          </PanelCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <PanelCard
            title="版本与部署状态"
            subtitle="把当前前后端版本、备份健康度和数据质量告警放到总览页，避免每次都进弹层或 SSH 排查。"
            icon={CheckCircle2}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <StatusLine
                label="前端版本"
                value={`${BUILD_INFO.version} · ${shortCommitLabel(BUILD_INFO.commit)}`}
                helper={`构建时间：${formatDateTime(BUILD_INFO.builtAt)}`}
              />
              <StatusLine
                label="后端版本"
                value={`${overview?.backend?.version || '未获取'} · ${shortCommitLabel(overview?.backend?.commit)}`}
                helper={`最后提交：${formatDateTime(overview?.backend?.committed_at)}`}
              />
              <StatusLine
                label="备份状态"
                value={
                  overview?.backup?.latest_filename
                    ? `${overview.backup.file_count || 0} 份备份`
                    : '暂无备份摘要'
                }
                helper={overview?.backup?.latest_filename || '建议先确认自动备份与下载链路正常'}
              />
              <StatusLine
                label="数据质量"
                value={`${overview?.data_quality?.suspected_records || 0} 条疑似乱码`}
                helper="可进入编码修复流程先扫描、再快照、再应用"
              />
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-800">最近状态刷新</div>
              <div className="mt-2 flex flex-wrap gap-3">
                <span>页面刷新：{formatDateTime(lastRefreshedAt)}</span>
                <span>前端分支：{BUILD_INFO.branch || '未知'}</span>
                <span>后端分支：{overview?.backend?.branch || '未知'}</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="运维发布检查"
            subtitle="按固定顺序检查版本、构建、备份和数据质量，减少“已经更新但页面没变”的发布误判。"
            icon={ClipboardCheck}
          >
            <div className="space-y-3">
              <ChecklistItem
                title="核对当前提交"
                body="先看前后端 commit 与构建时间，确认页面加载的不是旧包。"
              />
              <ChecklistItem
                title="确认前端构建产物"
                body="更新 frontend 源码后一定重新 build，再确认 index.html 引用的是最新 hash。"
              />
              <ChecklistItem
                title="确认后端健康"
                body="查看版本接口、备份摘要和关键 API，避免只更新了代码没重启服务。"
              />
              <ChecklistItem
                title="导入前先做预览"
                body="IP、DCIM、驻场导入都先看预览，再决定是否真正入库。"
              />
              <ChecklistItem
                title="修乱码先做快照"
                body="先扫描疑似乱码，再生成快照，确认后再应用修复；不满意可按快照回滚。"
              />
            </div>
          </PanelCard>
        </section>
      </div>
    </div>
  );
}

function HeroChip({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-[22px] border px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function HeroMetric({ title, value, helper, icon: Icon, accent }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className={`inline-flex rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/70">
        {title}
      </div>
      <div className="mt-1 text-3xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-300/75">{helper}</div>
    </div>
  );
}

function FocusCard({ title, value, helper, tone, icon: Icon }) {
  return (
    <div className={`rounded-[28px] border p-5 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">{title}</div>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="mt-4 text-4xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-sm leading-6 opacity-90">{helper}</div>
    </div>
  );
}

function PanelCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200/90 bg-white/86 shadow-[0_18px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Icon className="h-4.5 w-4.5 text-cyan-600" />
          {title}
        </div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function ProgressRow({ label, value, percent, tone }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone}`}
          style={{ width: `${clampPercent(percent)}%` }}
        ></div>
      </div>
    </div>
  );
}

function SignalCard({ title, value, helper, tone }) {
  return (
    <div className={`rounded-[24px] border p-4 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{title}</div>
      <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-sm leading-6 opacity-90">{helper}</div>
    </div>
  );
}

function TimelineItem({ log }) {
  return (
    <div className="flex gap-3 rounded-[24px] border border-slate-100 bg-slate-50/72 p-4 transition-colors hover:bg-slate-50">
      <div className="pt-0.5">
        <span className={`block h-2.5 w-2.5 rounded-full ${getTimelineTone(log.status)}`}></span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-slate-900">{log.username || '未知用户'}</span>
          <span className="text-slate-500">{formatActionLabel(log)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
            {String(log.status || 'unknown').toUpperCase()}
          </span>
          <span className="font-mono">{log.ip_address || 'unknown-ip'}</span>
          <span>{formatDateTime(log.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function DatacenterCard({ datacenter, onJump }) {
  const pressureTone =
    datacenter.warningCount > 0 || datacenter.uUtilization >= 80
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : datacenter.uUtilization >= 60
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  return (
    <button
      onClick={onJump}
      className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-cyan-200 hover:shadow-md"
      type="button"
    >
      <div className="absolute right-0 top-0 p-4 text-slate-100 transition-colors group-hover:text-cyan-50">
        <Server className="h-16 w-16" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-black tracking-tight text-slate-900">{datacenter.name}</div>
            <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
              {datacenter.location || '未填写位置'}
            </div>
          </div>
          <div className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${pressureTone}`}>
            压力 {datacenter.uUtilization}%
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <DataPoint label="机柜" value={datacenter.rackCount} />
          <DataPoint label="设备" value={datacenter.deviceCount} />
          <DataPoint label="告警" value={datacenter.warningCount} />
          <DataPoint label="功耗" value={`${(datacenter.powerLoad / 1000).toFixed(1)}kW`} />
        </div>

        <div className="mt-5 space-y-2">
          <ProgressRow
            label="服务器 / 计算"
            value={String(datacenter.serverCount)}
            percent={datacenter.deviceCount > 0 ? (datacenter.serverCount / datacenter.deviceCount) * 100 : 0}
            tone="from-cyan-500 to-sky-500"
          />
          <ProgressRow
            label="网络 / 安全"
            value={String(datacenter.networkCount)}
            percent={datacenter.deviceCount > 0 ? (datacenter.networkCount / datacenter.deviceCount) * 100 : 0}
            tone="from-indigo-500 to-violet-500"
          />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            打开机房视图
          </span>
          <ChevronRight className="h-4 w-4 text-cyan-600 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  );
}

function DataPoint({ label, value }) {
  return (
    <div className="rounded-[22px] bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-black tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function RecommendationItem({ title, body, tone }) {
  return (
    <div className={`rounded-[24px] border p-4 ${tone}`}>
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-2 text-sm leading-6 opacity-90">{body}</div>
    </div>
  );
}

function StatusLine({ label, value, helper }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-black tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{helper}</div>
    </div>
  );
}

function ChecklistItem({ title, body }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{body}</div>
    </div>
  );
}

function EmptyMessage({ text }) {
  return (
    <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}
