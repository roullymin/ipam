import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Box, FolderOpen, MapPin, Search, Server, Users } from 'lucide-react';

import { Modal } from '../common/UI';

const TYPE_META = {
  ip: { icon: Server, label: 'IP' },
  device: { icon: Box, label: '设备' },
  rack: { icon: MapPin, label: '机柜' },
  resident: { icon: Users, label: '驻场' },
  project: { icon: FolderOpen, label: '项目' },
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function GlobalSearchModal({ isOpen, onClose, items = [], onSelect }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    const sorted = [...items].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    if (!normalizedQuery) {
      return sorted.slice(0, 16);
    }

    return sorted
      .filter((item) => {
        const haystack = [item.title, item.subtitle, item.keywords, item.badge]
          .map(normalize)
          .join(' ');
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 24);
  }, [items, query]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const key = item.entityType || 'other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="全局搜索" size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
          支持搜索 IP、设备、机柜、驻场人员和项目名称。点击结果后会直接跳到对应模块。
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入 IP、设备名、机柜、姓名、公司或项目"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-colors focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groupedItems).map(([type, group]) => {
            const meta = TYPE_META[type] || TYPE_META.project;
            const Icon = meta.icon;
            return (
              <div key={type} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Icon className="h-4 w-4 text-cyan-600" />
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
                          <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                          {item.badge ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{item.subtitle}</div>
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
            没有匹配结果。可以试试姓名、公司、IP、设备名称或项目关键词。
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
