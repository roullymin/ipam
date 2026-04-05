import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  Radar,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';
import { loginRequest } from '../lib/api';

const FEATURE_CARDS = [
  {
    icon: Radar,
    title: '统一态势入口',
    description: '把 IP、机房、人员与审计统一放到同一张工作台上，减少来回切换。',
    accent: 'text-cyan-300',
  },
  {
    icon: ShieldCheck,
    title: '审计过程可追溯',
    description: '围绕高风险操作保留上下文和责任链，方便复盘、核查与验收。',
    accent: 'text-emerald-300',
  },
  {
    icon: Layers3,
    title: '多模块协同联动',
    description: '支持 IPAM、DCIM、驻场运营与备份恢复在同一平台协同处理。',
    accent: 'text-amber-300',
  },
];

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await loginRequest({ username, password });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onLogin(data.user || { username });
      } else {
        alert(data.message || '登录失败：账号或密码错误。');
      }
    } catch (error) {
      alert(`系统错误：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-stage flex min-h-[100dvh] items-center justify-center px-4 py-5 md:px-8 md:py-8">
      <div className="ambient-orb ambient-orb-a"></div>
      <div className="ambient-orb ambient-orb-b"></div>
      <div className="ambient-grid"></div>

      <div className="login-stage-inner relative z-10 flex w-full justify-center">
        <div className="login-shell relative grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-white/14">
        <section className="login-hero flex flex-col justify-between px-7 py-8 md:px-10 md:py-11">
          <div>
            <BrandLockup inverse size="lg" showTagline />

            <div className="mt-8 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/82">
                <Sparkles className="h-3.5 w-3.5" />
                {BRAND.consoleLabel}
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-white md:text-[4rem] md:leading-[0.95]">
                {BRAND.loginHeadline}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200/82 md:text-base">
                {BRAND.loginDescription}
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                当前版本聚焦
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-200/78">
                已完成统一品牌入口、部署状态可见化、驻场工作台增强、导入预览和乱码清洗工具链。
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {FEATURE_CARDS.map(({ icon: Icon, title, description, accent }) => (
              <div key={title} className="login-feature-card">
                <Icon className={`h-5 w-5 ${accent}`} />
                <div className="mt-3 text-sm font-bold text-white">{title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-300/78">{description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="login-panel flex items-center px-6 py-8 md:px-10 md:py-11">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">安全登录</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-[2.7rem]">
                进入系统
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                使用平台账号进入 {BRAND.shortName}，继续处理网络地址、机房设备、驻场信息与审计流程。
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  账号
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="login-input w-full px-4 py-3.5 text-sm outline-none"
                  placeholder="请输入用户名"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="login-input w-full px-4 py-3.5 text-sm outline-none"
                  placeholder="请输入密码"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-button flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-all"
              >
                <span>{loading ? '登录中...' : '进入系统'}</span>
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>

            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/92 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  当前入口已完成品牌与信息层级统一
                </div>
                <div className="mt-2 text-xs leading-6 text-slate-500">
                  后续将继续优化申请流程、设备变更中心、告警中心与全局搜索，让入口页更像正式运维平台。
                </div>
              </div>

              <div className="rounded-[24px] border border-sky-100 bg-sky-50/85 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  平台覆盖范围
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  {BRAND.tagline}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white/82 p-4 text-xs leading-6 text-slate-500 shadow-sm">
                <div className="font-bold text-slate-700">{BRAND.name}</div>
                <div className="mt-1">{BRAND.shortName} / IPAM / DCIM / 安全审计 / 驻场运营</div>
                <div className="mt-2">
                  当前入口已聚焦统一登录、流程联动与平台化运维体验。
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
