import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Layers3, Radar, ShieldCheck, Sparkles } from 'lucide-react';

import BrandLockup from './BrandLockup';
import { BRAND } from '../lib/brand';
import { loginRequest } from '../lib/api';

const FEATURE_CARDS = [
  {
    icon: Radar,
    title: '统一入口',
    description: '把地址、设备、人员和审计入口收在同一张工作台里。',
    accent: 'text-cyan-300',
  },
  {
    icon: ShieldCheck,
    title: '审计可追溯',
    description: '高风险操作会保留上下文和责任链，方便复核与验收。',
    accent: 'text-emerald-300',
  },
  {
    icon: Layers3,
    title: '模块协同',
    description: '支持 IPAM、DCIM、驻场与备份在同一平台联动。',
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

              <div className="mt-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/82">
                  <Sparkles className="h-3.5 w-3.5" />
                  {BRAND.consoleLabel}
                </div>

                <div className="login-visual-board mt-6">
                  <div className="login-visual-grid"></div>
                  <div className="login-visual-ring login-visual-ring-a"></div>
                  <div className="login-visual-ring login-visual-ring-b"></div>

                  <div className="signal-pill signal-pill-a">
                    <span className="signal-dot signal-dot-cyan"></span>
                    <span>IPAM</span>
                  </div>
                  <div className="signal-pill signal-pill-b">
                    <span className="signal-dot signal-dot-emerald"></span>
                    <span>DCIM</span>
                  </div>
                  <div className="signal-pill signal-pill-c">
                    <span className="signal-dot signal-dot-amber"></span>
                    <span>OPS</span>
                  </div>

                  <div className="signal-card signal-card-a">
                    <Radar className="h-5 w-5 text-cyan-300" />
                    <div className="signal-card-value">24x7</div>
                  </div>
                  <div className="signal-card signal-card-b">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <div className="signal-card-value">Audit</div>
                  </div>
                  <div className="signal-card signal-card-c">
                    <Layers3 className="h-5 w-5 text-amber-300" />
                    <div className="signal-card-value">Flow</div>
                  </div>
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
                  进入控制台
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  使用平台账号进入 {BRAND.shortName}，继续处理网络地址、机房设备、变更流程与审计工作。
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
                  <span>{loading ? '正在登录...' : `进入 ${BRAND.englishName}`}</span>
                  {!loading ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              </form>

              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/92 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    当前入口已完成统一品牌和平台壳层收口
                  </div>
                  <div className="mt-2 text-xs leading-6 text-slate-500">
                    登录后可直接进入搜索、告警、设备变更、驻场运营和备份恢复等工作区。
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-sky-50/85 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    平台覆盖范围
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{BRAND.tagline}</div>
                </div>

                <div className="rounded-[24px] border border-slate-200/80 bg-white/82 p-4 text-xs leading-6 text-slate-500 shadow-sm">
                  <div className="font-bold text-slate-700">{BRAND.name}</div>
                  <div className="mt-1">{BRAND.shortName} / IPAM / DCIM / 安全审计 / 驻场运营</div>
                  <div className="mt-2">当前入口以图形化品牌展示为主，减少大段标题对登录界面的压迫感。</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
