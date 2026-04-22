import React, { useEffect, useMemo, useState } from 'react';
import { HardDrive, Maximize, MapPin, MonitorUp, ShieldCheck } from 'lucide-react';

import RackElevation from '../../../components/RackElevation';
import { safeFetch } from '../../../lib/api';

const TEXT = {
  loading: '正在加载机柜立面图...',
  title: '机柜立面总览',
  eyebrow: '只读立面窗口',
  intro: '这个窗口专门用于查看机房机柜立面，不叠加后台操作区，页面支持正常滚轮浏览和直接放大查看。',
  readonly: '只读浏览',
  noData: '暂无机房数据',
  noDataHint: '当前没有可展示的机房和机柜数据。',
  noLocation: '未填写位置',
  datacenterList: '机房切换',
  rackCount: '机柜数',
  deviceCount: '设备数',
  utilization: '利用率',
  noRacks: '当前机房还没有机柜数据',
  noRacksHint: '等机柜资产录入后，这里会自动展示立面图。',
  openOverview: '打开只读总览',
};

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function DatacenterChip({ datacenter, active, onClick }) {
  return (
    <button
      onClick={() => onClick(datacenter.id)}
      type="button"
      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
        active
          ? 'border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="text-sm font-black">{datacenter.name}</div>
      <div className="mt-1 text-xs text-slate-500">{datacenter.location || TEXT.noLocation}</div>
    </button>
  );
}

export default function DcimElevationPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDatacenterId, setActiveDatacenterId] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const response = await safeFetch('/api/public/dcim-overview/');
      const data = response.ok ? await response.json().catch(() => null) : null;
      if (!active) return;
      setPayload(data);
      setLoading(false);
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

  const activeDatacenter = useMemo(
    () => payload?.datacenters?.find((item) => String(item.id) === String(activeDatacenterId)) || null,
    [payload, activeDatacenterId],
  );

  const openOverview = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('dc-overview', '1');
    if (activeDatacenter?.id) {
      url.searchParams.set('datacenter', String(activeDatacenter.id));
    }
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfe_0%,#eef4f9_100%)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-8 py-7 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                <MonitorUp className="h-4 w-4" />
                {TEXT.eyebrow}
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">{TEXT.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{TEXT.intro}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {TEXT.readonly}
              </div>
              <button
                onClick={openOverview}
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"
              >
                <Maximize className="h-4 w-4" />
                {TEXT.openOverview}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
              <MapPin className="h-4 w-4" />
              {TEXT.datacenterList}
            </div>
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
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-cyan-700">{activeDatacenter.name}</div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-slate-900">{activeDatacenter.location || TEXT.noLocation}</div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatPill label={TEXT.rackCount} value={activeDatacenter.rack_count} />
                    <StatPill label={TEXT.deviceCount} value={activeDatacenter.device_count} />
                    <StatPill label={TEXT.utilization} value={`${activeDatacenter.utilization}%`} />
                  </div>
                </div>
              </section>

              {activeDatacenter.racks.length ? (
                <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {activeDatacenter.racks.map((rack) => (
                    <div key={rack.id} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                            {rack.code || `机柜 ${rack.id}`}
                          </div>
                          <div className="mt-3 text-2xl font-black text-slate-900">{rack.name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {rack.height}U · {rack.device_count} 台设备 · 空闲 {rack.free_units}U
                          </div>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                          {rack.utilization}%
                        </div>
                      </div>
                      <div className="overflow-x-auto pb-1">
                        <RackElevation rack={rack} devices={rack.devices || []} readonly showHeader={false} unitHeight={18} />
                      </div>
                    </div>
                  ))}
                </section>
              ) : (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
                  <HardDrive className="mx-auto h-10 w-10 text-slate-300" />
                  <div className="mt-4 text-2xl font-black text-slate-900">{TEXT.noRacks}</div>
                  <div className="mt-3 text-sm text-slate-500">{TEXT.noRacksHint}</div>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
