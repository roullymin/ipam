import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  EyeOff,
  Info,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

import { Modal } from '../common/UI';

const LEVEL_META = {
  high: {
    icon: AlertTriangle,
    label: '高优先级',
    card: 'border-rose-200 bg-rose-50/70',
    badge: 'bg-rose-100 text-rose-700',
    iconTone: 'text-rose-600',
  },
  medium: {
    icon: Clock3,
    label: '处理中',
    card: 'border-amber-200 bg-amber-50/70',
    badge: 'bg-amber-100 text-amber-700',
    iconTone: 'text-amber-600',
  },
  info: {
    icon: Info,
    label: '提示',
    card: 'border-cyan-200 bg-cyan-50/70',
    badge: 'bg-cyan-100 text-cyan-700',
    iconTone: 'text-cyan-600',
  },
};

function AlertCard({ item, onSelect, onIgnore, onRestore, ignored = false }) {
  const meta = LEVEL_META[item.level] || LEVEL_META.info;
  const Icon = meta.icon;

  return (
    <div className={`rounded-2xl border px-4 py-4 ${ignored ? 'border-slate-200 bg-slate-50/70' : meta.card}`}>
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onSelect?.(item)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Icon className={`h-5 w-5 ${ignored ? 'text-slate-400' : meta.iconTone}`} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-black text-slate-900">{item.title}</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ignored ? 'bg-slate-100 text-slate-600' : meta.badge}`}>
                {ignored ? '已忽略' : meta.label}
              </span>
              {item.count ? (
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  {item.count}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600">{item.description}</div>
            {item.actionLabel ? (
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700">
                <ShieldAlert className="h-3.5 w-3.5" />
                {item.actionLabel}
              </div>
            ) : null}
          </div>
        </button>

        <div className="flex flex-shrink-0 items-center gap-2">
          {ignored ? (
            <button
              type="button"
              onClick={() => onRestore?.(item)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-cyan-200 hover:text-cyan-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onIgnore?.(item)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-amber-200 hover:text-amber-700"
            >
              <EyeOff className="h-3.5 w-3.5" />
              忽略
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelect?.(item)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:border-cyan-200 hover:text-cyan-700"
            title="前往处理"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('zh-CN', { hour12: false });
}

export default function AlertCenterModal({
  isOpen,
  onClose,
  alerts = [],
  ignoredAlerts = [],
  recentHistory = [],
  onSelect,
  onIgnore,
  onRestore,
}) {
  const sortAlerts = (source) =>
    [...source].sort((a, b) => {
      const levelWeight = { high: 3, medium: 2, info: 1 };
      return (levelWeight[b.level] || 0) - (levelWeight[a.level] || 0);
    });

  const activeAlerts = sortAlerts(alerts);
  const archivedAlerts = sortAlerts(ignoredAlerts);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="告警中心" size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          汇总待审批、设备异常、备份状态、数据质量和安全风险。可直接忽略暂不处理的项目，也可以恢复后重新跟进。
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">待处理</div>
            <div className="mt-2 text-2xl font-black text-slate-950">{activeAlerts.length}</div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-400">高优先级</div>
            <div className="mt-2 text-2xl font-black text-rose-700">
              {activeAlerts.filter((item) => item.level === 'high').length}
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-500">处理中</div>
            <div className="mt-2 text-2xl font-black text-cyan-700">
              {activeAlerts.filter((item) => item.level !== 'info').length}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">已忽略</div>
            <div className="mt-2 text-2xl font-black text-slate-700">{archivedAlerts.length}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-slate-900">待处理告警</div>
            <div className="text-xs text-slate-400">点击卡片可直接跳到对应工作区</div>
          </div>
          {activeAlerts.length ? (
            activeAlerts.map((item) => (
              <AlertCard key={item.id} item={item} onSelect={onSelect} onIgnore={onIgnore} />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-700">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              当前没有待处理告警，系统处于相对平稳状态。
            </div>
          )}
        </div>

        {archivedAlerts.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-slate-900">已忽略告警</div>
              <div className="text-xs text-slate-400">恢复后会重新进入待处理列表</div>
            </div>
            {archivedAlerts.map((item) => (
              <AlertCard
                key={item.id}
                item={item}
                ignored
                onSelect={onSelect}
                onRestore={onRestore}
              />
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-slate-900">最近处理记录</div>
            <div className="text-xs text-slate-400">忽略、恢复和跳转处理都会留一条轻量记录</div>
          </div>
          {recentHistory.length ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {recentHistory.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-white bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.detail || '无附加说明'}</div>
                    </div>
                    <div className="flex-shrink-0 text-[11px] font-semibold text-slate-400">
                      {formatDateTime(item.occurredAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              还没有处理记录。开始忽略、恢复或跳转处理告警后，这里会显示最近动作。
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
