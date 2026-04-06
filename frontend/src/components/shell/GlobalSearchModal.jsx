import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Box,
  FolderOpen,
  GitPullRequestArrow,
  MapPin,
  Search,
  Server,
  Users,
} from 'lucide-react';

import { Modal } from '../common/UI';

const TYPE_META = {
  all: { label: '全部' },
  ip: { icon: Server, label: 'IP 地址' },
  device: { icon: Box, label: '设备' },
  rack: { icon: MapPin, label: '机柜' },
  resident: { icon: Users, label: '驻场' },
  project: { icon: FolderOpen, label: '项目' },
  'change-request': { icon: GitPullRequestArrow, label: '变更申请' },
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const getMatchScore = (item, normalizedQuery) => {
  if (!normalizedQuery) return item.weight || 0;

  const title = normalize(item.title);
  const subtitle = normalize(item.subtitle);
  const keywords = normalize(item.keywords);
  const badge = normalize(item.badge);

  let score = item.weight || 0;
  if (title === normalizedQuery) score += 120;
  else if (title.startsWith(normalizedQuery)) score += 80;
  else if (title.includes(normalizedQuery)) score += 55;

  if (keywords.includes(normalizedQuery)) score += 30;
  if (subtitle.includes(normalizedQuery)) score += 20;
  if (badge.includes(normalizedQuery)) score += 10;

  return score;
};

function HighlightText({ text, query }) {
  const normalizedQuery = normalize(query);
  const rawText = String(text || '');

  if (!normalizedQuery) return rawText;

  const lowerText = rawText.toLowerCase();
  const start = lowerText.indexOf(normalizedQuery);
  if (start === -1) return rawText;

  const end = start + normalizedQuery.length;
  return (
    <>
      {rawText.slice(0, start)}
      <mark className="rounded bg-cyan-100 px-0.5 text-inherit">{rawText.slice(start, end)}</mark>
      {rawText.slice(end)}
    </>
  );
}

export default function GlobalSearchModal({ isOpen, onClose, items = [], onSelect }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setTypeFilter('all');
    }
  }, [isOpen]);

  const sortedItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    return [...items]
      .map((item) => ({ ...item, _score: getMatchScore(item, normalizedQuery) }))
      .sort((left, right) => right._score - left._score);
  }, [items, query]);

  const availableTypes = useMemo(() => {
    const counts = new Map([['all', sortedItems.length]]);
    sortedItems.forEach((item) => {
      const key = item.entityType || 'other';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .filter(([key]) => TYPE_META[key])
      .map(([key, count]) => ({ key, count, label: TYPE_META[key].label }));
  }, [sortedItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    return sortedItems
      .filter((item) => {
        if (typeFilter !== 'all' && item.entityType !== typeFilter) return false;
        if (!normalizedQuery) return true;
        const haystack = [item.title, item.subtitle, item.keywords, item.badge]
          .map(normalize)
          .join(' ');
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 24);
  }, [query, sortedItems, typeFilter]);

  const groupedItems = useMemo(
    () =>
      filteredItems.reduce((acc, item) => {
        const key = item.entityType || 'other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {}),
    [filteredItems],
  );

  const topResult = filteredItems[0] || null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="全局搜索" size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
          支持搜索 IP、设备、机柜、驻场、项目和设备变更。按 <span className="font-semibold">Enter</span> 可直接打开当前最匹配的结果。
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && topResult) {
                event.preventDefault();
                onSelect?.(topResult);
              }
            }}
            placeholder="输入 IP、设备名、机柜、申请编号、姓名、公司或项目"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-colors focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {availableTypes.map((type) => (
            <button
              key={type.key}
              onClick={() => setTypeFilter(type.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                typeFilter === type.key
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
              type="button"
            >
              {type.label} {type.count}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>当前显示 {filteredItems.length} 条结果</span>
          {topResult ? <span>回车打开：{topResult.title}</span> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groupedItems).map(([type, group]) => {
            const meta = TYPE_META[type] || TYPE_META.project;
            const Icon = meta.icon;
            return (
              <div key={type} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  {Icon ? <Icon className="h-4 w-4 text-cyan-600" /> : null}
                  {meta.label}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {group.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelect?.(item)}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-cyan-200 hover:bg-cyan-50/40"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-bold text-slate-900">
                            <HighlightText text={item.title} query={query} />
                          </div>
                          {item.badge ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              <HighlightText text={item.badge} query={query} />
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          <HighlightText text={item.subtitle} query={query} />
                        </div>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {!filteredItems.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            没有匹配结果。试试输入申请编号、IP、设备名、机柜、姓名、公司或项目关键字。
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
