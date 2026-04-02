import React, { useState } from 'react';
import { CheckCircle2, Layers3, Radar, ShieldCheck } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';
import { loginRequest } from '../lib/api';

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
    <div className="login-stage min-h-screen px-5 py-8 md:px-8 md:py-10">
      <div className="ambient-orb ambient-orb-a"></div>
      <div className="ambient-orb ambient-orb-b"></div>

      <div className="login-shell relative z-10 mx-auto grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-white/12">
        <section className="login-hero px-6 py-8 md:px-10 md:py-12">
          <BrandLockup inverse size="lg" showTagline />

          <div className="mt-8 max-w-xl">
            <div className="inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
              {BRAND.consoleLabel}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
              {BRAND.loginHeadline}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-200/82 md:text-base">
              {BRAND.loginDescription}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="login-feature-card">
              <Radar className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 text-sm font-bold text-white">统一态势入口</div>
              <div className="mt-1 text-xs leading-5 text-slate-300/78">
                把 IP、机房、人员与审计放进同一张工作台。
              </div>
            </div>
            <div className="login-feature-card">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <div className="mt-3 text-sm font-bold text-white">审计可追溯</div>
              <div className="mt-1 text-xs leading-5 text-slate-300/78">
                围绕高风险操作保留审计上下文和角色边界。
              </div>
            </div>
            <div className="login-feature-card">
              <Layers3 className="h-5 w-5 text-amber-300" />
              <div className="mt-3 text-sm font-bold text-white">多模块联动</div>
              <div className="mt-1 text-xs leading-5 text-slate-300/78">
                支持 IPAM、DCIM、驻场运营与备份恢复协同运行。
              </div>
            </div>
          </div>
        </section>

        <section className="login-panel px-6 py-8 md:px-10 md:py-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">安全登录</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">进入系统</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                使用平台账号进入 {BRAND.shortName}，继续处理网络地址、机房设备和运营流程。
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
                className="login-button flex w-full items-center justify-center py-3.5 text-sm font-bold text-white transition-all"
              >
                {loading ? '登录中...' : '进入系统'}
              </button>
            </form>

            <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                当前版本已统一品牌和入口壳层
              </div>
              <div className="mt-2 text-xs leading-6 text-slate-500">
                下一步建议继续优化总览页、网络地址页和机房设备页的信息层级，让页面行为更贴近真实运维驾驶台。
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mx-auto mt-5 max-w-6xl px-1 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{BRAND.name}</span> / {BRAND.tagline}
      </div>
      <div className="mx-auto mt-3 max-w-6xl px-1 text-[11px] leading-5 text-slate-400">
        当前版本优先保留现有账号与业务数据，同时逐步补齐更适合生产环境的认证、角色、审计和恢复能力。
      </div>
      <div className="mx-auto mt-3 flex max-w-6xl items-center gap-2 px-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
        <span>{BRAND.shortName}</span>
        <span className="text-slate-300">/</span>
        <span>基础设施运营</span>
        <span className="text-slate-300">/</span>
        <span>控制台</span>
      </div>
    </div>
  );
}
