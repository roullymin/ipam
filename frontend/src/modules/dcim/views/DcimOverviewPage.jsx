import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  HardDrive,
  Link as LinkIcon,
  MapPin,
  Server,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { safeFetch } from '../../../lib/api';
import RackElevation from '../../../components/RackElevation';

const TEXT = {
  loading: '正在加载机房只读概览...',
  eyebrow: '机房容量只读概览',
  title: '机房容量概览',
  intro:
    '这个页面用于向项目负责人或管理层展示机房容量、机柜数量、设备规模、空闲 U 位和功率情况，页面仅提供只读查看能力，适合直接分享。',
  readonly: '数据只读展示',
  noLocation: '未填写位置说明',
  rackCount: '机柜数量',
  deviceCount: '设备数量',
  freeUnits: '空闲 U 位',
  actualPower: 'PDU 实测功率',
  plannedPower: '设计总负载',
  totalCapacity: '总容量',
  usedCapacity: '已用容量',
  utilization: '空间占用率',
  noData: '暂无机房数据',
  noDataHint: '当前还没有可用于展示的机房容量信息。',
  summaryDatacenter: '纳入概览的机房区域',
  summaryRack: '机柜总量与容量总览',
  summaryDevice: '设备总量与剩余空间',
  summaryPower: '整体占用率与功率概况',
  copyLink: '复制链接',
  copySuccess: '已复制分享链接',
  datacenterList: '机房列表',
  datacenterHint: '切换机房后可查看对应的只读排位图与容量情况。',
  elevationTitle: '机柜排位概览',
  elevationHint: '只读排位图适合直接发给领导查看机房是否还有位置，不提供任何编辑入口。',
  noRacks: '当前机房还没有机柜数据',
  noRacksHint: '等机柜资产录入后，这里会自动显示只读排位图。',
  rackSummary: '机柜概况',
};

const safeInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

function SummaryCard({ icon: Icon, label, value, subtext, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${tones[tone] || tones.default}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      </div>
      <div className="mt-4 text-4xl font-black leading-none">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{subtext}</div>
    </div>
  );
}

function MiniStat({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-white text-slate-900',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-2xl border border-slate-200 px-4 py-4 ${tones[tone] || tones.default}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black leading-none">{value}</div>
    </div>
  );
}

function DatacenterChip({ datacenter, active, onClick }) {
  return (
    <button
      onClick={() => onClick(datacenter.id)}
      type="button"
      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="text-sm font-black">{datacenter.name}</div>
      <div className="mt-1 text-xs text-slate-500">{datacenter.location || TEXT.noLocation}</div>
    </button>
  );
}

function RackOverviewCard({ rack }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
            {rack.code || `机柜 ${rack.id}`}
          </div>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{rack.name}</h3>
          <div className="mt-1 text-sm text-slate-500">
            {rack.height}U 标准机柜 · {rack.device_count} 台设备
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            rack.utilization >= 85
              ? 'bg-rose-50 text-rose-700'
              : rack.utilization >= 65
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {TEXT.utilization} {rack.utilization}%
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniStat label={TEXT.freeUnits} value={`${rack.free_units}U`} tone="emerald" />
        <MiniStat label={TEXT.plannedPower} value={`${rack.planned_power}W`} />
        <MiniStat label={TEXT.actualPower} value={`${rack.actual_power}W`} tone="blue" />
      </div>
    </div>
  );
}

export default function DcimOverviewPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeDatacenterId, setActiveDatacenterId] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const response = await safeFetch('/api/public/dcim-overview/');
      const data = response.ok ? await response.json().catch(() => null) : null;
      if (active) {
        setPayload(data);
        setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!payload?.datacenters?.length) return;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const queryId = params?.get('datacenter');
    const matched = payload.datacenters.find((item) => String(item.id) === String(queryId));
    setActiveDatacenterId(matched?.id || payload.datacenters[0].id);
  }, [payload]);

  const summary = useMemo(
    () =>
      payload?.summary || {
        datacenter_count: 0,
        rack_count: 0,
        device_count: 0,
        total_u: 0,
        used_u: 0,
        free_u: 0,
        utilization: 0,
        planned_power: 0,
        actual_power: 0,
      },
    [payload],
  );

  const activeDatacenter = useMemo(
    () => payload?.datacenters?.find((item) => String(item.id) === String(activeDatacenterId)) || null,
    [payload, activeDatacenterId],
  );

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('dc-overview', '1');
    if (activeDatacenter?.id) {
      url.searchParams.set('datacenter', String(activeDatacenter.id));
    }
    return url.toString();
  }, [activeDatacenter?.id]);

  const copyShareLink = async () => {
    if (!shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        {TEXT.loading}
      </div>
    );
  }

  if (!payload?.datacenters?.length) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl rounded-[30px] border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
          <HardDrive className="mx-auto h-12 w-12 text-slate-300" />
          <div className="mt-4 text-3xl font-black text-slate-900">{TEXT.noData}</div>
          <div className="mt-3 text-sm text-slate-500">{TEXT.noDataHint}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-8 py-7 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-600">
                <MapPin className="h-4 w-4" />
                {TEXT.eyebrow}
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">{TEXT.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{TEXT.intro}</p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {TEXT.readonly} · {payload?.updated_at || '-'}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <LinkIcon className="h-4 w-4 text-blue-600" />
                <span className="max-w-[380px] truncate">{shareUrl}</span>
                <button
                  onClick={copyShareLink}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? TEXT.copySuccess : TEXT.copyLink}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={MapPin} label={TEXT.eyebrow} value={summary.datacenter_count} subtext={TEXT.summaryDatacenter} />
          <SummaryCard icon={HardDrive} label={TEXT.rackCount} value={summary.rack_count} subtext={TEXT.summaryRack} tone="blue" />
          <SummaryCard icon={Server} label={TEXT.deviceCount} value={summary.device_count} subtext={`空闲容量 ${summary.free_u}U`} />
          <SummaryCard icon={Zap} label={TEXT.actualPower} value={`${summary.actual_power}W`} subtext={`整体占用率 ${summary.utilization}%`} tone="emerald" />
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
              <MapPin className="h-4 w-4" />
              {TEXT.datacenterList}
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-500">{TEXT.datacenterHint}</div>
            <div className="mt-5 space-y-3">
              {payload.datacenters.map((datacenter) => (
                <DatacenterChip
                  key={datacenter.id}
                  datacenter={datacenter}
                  active={String(datacenter.id) === String(activeDatacenter?.id)}
                  onClick={setActiveDatacenterId}
                />
              ))}
            </div>
          </div>

          {activeDatacenter ? (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-600">{activeDatacenter.name}</div>
                    <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">{TEXT.rackSummary}</h2>
                    <div className="mt-2 text-sm text-slate-500">{activeDatacenter.location || TEXT.noLocation}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MiniStat label={TEXT.rackCount} value={activeDatacenter.rack_count} tone="blue" />
                    <MiniStat label={TEXT.deviceCount} value={activeDatacenter.device_count} />
                    <MiniStat label={TEXT.usedCapacity} value={`${activeDatacenter.used_u}U`} />
                    <MiniStat label={TEXT.freeUnits} value={`${activeDatacenter.free_u}U`} tone="emerald" />
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeDatacenter.racks.map((rack) => (
                  <RackOverviewCard key={rack.id} rack={rack} />
                ))}
              </div>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                      <TrendingUp className="h-4 w-4" />
                      {TEXT.elevationTitle}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{TEXT.elevationHint}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MiniStat label={TEXT.plannedPower} value={`${activeDatacenter.planned_power}W`} />
                    <MiniStat label={TEXT.actualPower} value={`${activeDatacenter.actual_power}W`} tone="blue" />
                    <MiniStat label={TEXT.totalCapacity} value={`${activeDatacenter.total_u}U`} />
                    <MiniStat label={TEXT.utilization} value={`${activeDatacenter.utilization}%`} tone="emerald" />
                  </div>
                </div>

                {activeDatacenter.racks.length ? (
                  <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {activeDatacenter.racks.map((rack) => (
                      <div key={rack.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                              {rack.code || `机柜 ${rack.id}`}
                            </div>
                            <div className="mt-3 text-xl font-black text-slate-900">{rack.name}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {rack.height}U · {rack.device_count} 台设备 · 空闲 {rack.free_units}U
                            </div>
                          </div>
                          <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                            {rack.utilization}%
                          </div>
                        </div>
                        <RackElevation rack={rack} devices={rack.devices || []} readonly showHeader={false} unitHeight={18} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-8 py-14 text-center">
                    <HardDrive className="mx-auto h-10 w-10 text-slate-300" />
                    <div className="mt-4 text-2xl font-black text-slate-900">{TEXT.noRacks}</div>
                    <div className="mt-3 text-sm text-slate-500">{TEXT.noRacksHint}</div>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
