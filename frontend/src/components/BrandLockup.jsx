import React from 'react';

import { BRAND } from '../lib/brand';


const SIZE_MAP = {
  sm: {
    mark: 'h-11 w-11',
    core: 'h-3 w-3',
    dotA: 'left-[10px] top-[8px] h-2.5 w-2.5',
    dotB: 'right-[8px] bottom-[10px] h-2 w-2',
    title: 'text-base',
    subtitle: 'text-[10px]',
    tagline: 'text-[11px]',
  },
  md: {
    mark: 'h-14 w-14',
    core: 'h-4 w-4',
    dotA: 'left-[12px] top-[10px] h-3 w-3',
    dotB: 'right-[10px] bottom-[12px] h-2.5 w-2.5',
    title: 'text-lg',
    subtitle: 'text-[11px]',
    tagline: 'text-xs',
  },
  lg: {
    mark: 'h-16 w-16',
    core: 'h-4.5 w-4.5',
    dotA: 'left-[13px] top-[11px] h-3 w-3',
    dotB: 'right-[11px] bottom-[13px] h-3 w-3',
    title: 'text-2xl',
    subtitle: 'text-xs',
    tagline: 'text-sm',
  },
};

export default function BrandLockup({
  size = 'md',
  inverse = false,
  showTagline = false,
  className = '',
}) {
  const palette = inverse
    ? {
        title: 'text-white',
        subtitle: 'text-cyan-100/70',
        tagline: 'text-slate-200/80',
      }
    : {
        title: 'text-slate-950',
        subtitle: 'text-slate-500',
        tagline: 'text-slate-600',
      };
  const config = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className={`flex items-center gap-4 ${className}`.trim()}>
      <div
        className={`brand-mark relative ${config.mark} overflow-hidden rounded-[28px] border border-white/20 shadow-[0_18px_34px_rgba(8,24,43,0.22)]`}
        aria-hidden="true"
      >
        <span className="brand-mark__glow absolute inset-0"></span>
        <span className="brand-mark__ring brand-mark__ring--outer absolute inset-[5px] rounded-[22px]"></span>
        <span className="brand-mark__ring brand-mark__ring--inner absolute inset-[13px] rounded-[18px]"></span>
        <span
          className={`brand-mark__core absolute left-1/2 top-1/2 ${config.core} -translate-x-1/2 -translate-y-1/2 rounded-full`}
        ></span>
        <span className={`brand-mark__node absolute ${config.dotA} rounded-full`}></span>
        <span className={`brand-mark__node brand-mark__node--secondary absolute ${config.dotB} rounded-full`}></span>
      </div>

      <div className="min-w-0">
        <div className={`brand-display ${config.title} font-black tracking-tight ${palette.title}`}>
          {BRAND.name}
        </div>
        <div className={`${config.subtitle} font-semibold uppercase tracking-[0.26em] ${palette.subtitle}`}>
          {BRAND.englishName}
        </div>
        {showTagline && (
          <div className={`mt-1 max-w-xl ${config.tagline} ${palette.tagline}`}>
            {BRAND.tagline}
          </div>
        )}
      </div>
    </div>
  );
}
