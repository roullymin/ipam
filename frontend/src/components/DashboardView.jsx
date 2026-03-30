import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Clock3,
  MapPin,
  Server,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

const safeInt = (val, def = 0) => {
  const parsed = Number.parseInt(val, 10);
  return Number.isNaN(parsed) ? def : parsed;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const DashboardView = ({
  datacenters,
  racks,
  rackDevices,
  ips,
  logs,
  residentStaff = [],
  onJumpToDc,
}) => {
  const stats = useMemo(() => {
    const totalAssets = rackDevices.length;
    const totalIPs = ips.length;
    const activeIPs = ips.filter((item) => item.status === 'online' || item.status === 'active').length;
    const ipUsageRate = totalIPs > 0 ? Math.round((activeIPs / totalIPs) * 100) : 0;
    const totalPower = racks.reduce((sum, rack) => sum + safeInt(rack.pdu_power, 0), 0);
    const warnings = rackDevices.filter(
      (device) => device.status === 'offline' || device.status === 'maintenance',
    ).length;

    const residentApproved = residentStaff.filter((item) => item.approval_status === 'approved');
    const residentPending = residentStaff.filter((item) => item.approval_status === 'pending');
    const residentExpiring = residentApproved.filter((item) => {
      if (!item.end_date) return false;
      const delta = Math.ceil((new Date(item.end_date) - new Date()) / (1000 * 60 * 60 * 24));
      return delta >= 0 && delta <= 7;
    });

    const locationStats = datacenters.map((datacenter) => {
      const dcRacks = racks.filter((rack) => String(rack.datacenter) === String(datacenter.id));
      const rackIds = dcRacks.map((rack) => String(rack.id));
      const dcDevices = rackDevices.filter((device) => rackIds.includes(String(device.rack)));

      const totalU = dcRacks.reduce((sum, rack) => sum + safeInt(rack.height, 42), 0);
      const usedU = dcDevices.reduce((sum, device) => sum + safeInt(device.u_height, 1), 0);
      const uUtilization = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;
      const serverCount = dcDevices.filter(
        (device) => device.device_type === 'server' || device.device_type === 'vm',
      ).length;
      const networkCount = dcDevices.filter(
        (device) =>
          device.device_type?.startsWith('switch') ||
          device.device_type === 'router' ||
          device.device_type === 'firewall',
      ).length;

      return {
        ...datacenter,
        rackCount: dcRacks.length,
        deviceCount: dcDevices.length,
        serverCount,
        networkCount,
        uUtilization,
        powerLoad: dcRacks.reduce((sum, rack) => sum + safeInt(rack.pdu_power, 0), 0),
      };
    });

    return {
      totalAssets,
      totalIPs,
      activeIPs,
      ipUsageRate,
      totalPower,
      warnings,
      residentApproved: residentApproved.length,
      residentPending: residentPending.length,
      residentExpiring: residentExpiring.length,
      residentSeatsTodo: residentStaff.filter((item) => item.needs_seat && !item.seat_number).length,
      locationStats,
    };
  }, [datacenters, racks, rackDevices, ips, residentStaff]);

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-8 animate-in fade-in duration-500">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">运营概览</h2>
            <p className="mt-2 text-sm text-slate-500">
              把地址、机房、设备和驻场人员状态收敛到一个更像运维驾驶舱的视图里。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
            <Clock3 className="h-4 w-4 text-sky-500" />
            {new Date().toLocaleDateString()}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <KPICard title="资产总数" value={stats.totalAssets} subtext="当前纳管设备" icon={Server} color="bg-sky-500" />
          <KPICard
            title="IP 活跃数"
            value={stats.activeIPs}
            subtext={`共 ${stats.totalIPs} 个地址，活跃率 ${stats.ipUsageRate}%`}
            icon={Activity}
            color="bg-emerald-500"
          />
          <KPICard
            title="实测总功耗"
            value={`${(stats.totalPower / 1000).toFixed(1)} kW`}
            subtext="按机柜 PDU 实测汇总"
            icon={Zap}
            color="bg-amber-500"
          />
          <KPICard
            title="待处理告警"
            value={stats.warnings}
            subtext="离线或维护中的设备"
            icon={AlertTriangle}
            color="bg-rose-500"
          />
        </div>

        <div>
          <h3 className="mb-4 flex items-center text-lg font-bold text-slate-800">
            <MapPin className="mr-2 h-5 w-5 text-sky-600" />
            机房区域透视
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {stats.locationStats.map((datacenter) => (
              <div
                key={datacenter.id}
                onClick={() => onJumpToDc(datacenter.id)}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white/88 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                  <Server className="h-24 w-24" />
                </div>

                <div className="relative z-10 mb-4 flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 transition-colors group-hover:text-sky-600">
                      {datacenter.name}
                    </h4>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-400">
                      {datacenter.location}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      datacenter.uUtilization > 80 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    空间 {datacenter.uUtilization}%
                  </span>
                </div>

                <div className="relative z-10 mb-4 grid grid-cols-2 gap-4">
                  <MiniStat title="机柜数量" value={datacenter.rackCount} />
                  <MiniStat title="设备总数" value={datacenter.deviceCount} />
                </div>

                <div className="relative z-10 space-y-2">
                  <BarRow
                    label="服务器 / 计算"
                    value={datacenter.serverCount}
                    total={datacenter.deviceCount}
                    color="bg-sky-500"
                  />
                  <BarRow
                    label="网络 / 交换"
                    value={datacenter.networkCount}
                    total={datacenter.deviceCount}
                    color="bg-indigo-500"
                  />
                </div>

                <div className="relative z-10 mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {datacenter.powerLoad} W 当前负载
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/88 shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <h3 className="flex items-center font-bold text-slate-800">
                <TrendingUp className="mr-2 h-4 w-4 text-slate-500" />
                最近动态
              </h3>
            </div>
            <div className="divide-y divide-slate-50">
              {logs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between px-6 py-3 text-sm transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        String(log.status || '').toLowerCase() === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    ></span>
                    <span className="font-medium text-slate-700">{log.username}</span>
                    <span className="text-slate-500">
                      {log.action === 'login' ? '执行了系统登录' : log.action}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">{formatDateTime(log.timestamp)}</span>
                </div>
              ))}
              {logs.length === 0 && <div className="p-6 text-center text-sm text-slate-400">暂无最近活动</div>}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/88 shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <h3 className="flex items-center font-bold text-slate-800">
                <Users className="mr-2 h-4 w-4 text-slate-500" />
                驻场概况
              </h3>
              <p className="mt-1 text-xs text-slate-500">把人员、审批和到期风险直接带到首页。</p>
            </div>
            <div className="space-y-4 p-5">
              <ResidentStat
                icon={UserCard}
                title="当前在场"
                value={stats.residentApproved}
                desc="已通过审核的驻场人员"
                tone="bg-emerald-50 text-emerald-700 border-emerald-200"
              />
              <ResidentStat
                icon={ClipboardCheck}
                title="待审核"
                value={stats.residentPending}
                desc="待管理员确认并导出签批"
                tone="bg-amber-50 text-amber-700 border-amber-200"
              />
              <ResidentStat
                icon={AlertTriangle}
                title="即将到期"
                value={stats.residentExpiring}
                desc="7 天内需要续期或离场确认"
                tone="bg-rose-50 text-rose-700 border-rose-200"
              />
              <ResidentStat
                icon={MapPin}
                title="待安排座位"
                value={stats.residentSeatsTodo}
                desc="需要补齐办公位置或座位号"
                tone="bg-sky-50 text-sky-700 border-sky-200"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function KPICard({ title, value, subtext, icon: Icon, color }) {
  return (
    <div className="flex items-start space-x-4 rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <div className={`rounded-2xl p-3 text-white shadow-lg ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
        <h3 className="mt-0.5 text-2xl font-black text-slate-800">{value}</h3>
        <p className="mt-1 text-xs text-slate-500">{subtext}</p>
      </div>
    </div>
  );
}

function MiniStat({ title, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 transition-colors group-hover:bg-sky-50/60">
      <div className="text-[10px] font-bold uppercase text-slate-400">{title}</div>
      <div className="text-xl font-black text-slate-700">{value}</div>
    </div>
  );
}

function BarRow({ label, value, total, color }) {
  const width = total > 0 ? (value / total) * 100 : 0;
  return (
    <>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-bold text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }}></div>
      </div>
    </>
  );
}

function ResidentStat({ icon: Icon, title, value, desc, tone }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="mt-3 text-3xl font-black">{value}</div>
      <div className="mt-1 text-xs leading-5 opacity-90">{desc}</div>
    </div>
  );
}

function UserCard(props) {
  return <Users {...props} />;
}

export default DashboardView;
