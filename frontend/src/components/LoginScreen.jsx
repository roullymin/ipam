import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { BRAND } from '../lib/brand';
import { loginRequest } from '../lib/api';

const makeCaptcha = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';
  for (let index = 0; index < 4; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
};

const getLoginErrorMessage = (response, data) => {
  if (data?.message || data?.detail) {
    return data.message || data.detail;
  }
  if (response.status === 0) {
    return '无法连接后端服务，请检查 backend 容器和网络配置。';
  }
  if ([502, 503, 504].includes(response.status)) {
    return '后端服务暂时不可用，请检查数据库、OpenBao 或容器日志。';
  }
  if (response.status === 429) {
    return '登录尝试过于频繁，请稍后再试。';
  }
  if (response.status === 403) {
    return '登录请求被安全策略拒绝，请检查来源 IP 和 HTTPS 配置。';
  }
  return `登录失败（HTTP ${response.status || '未知'}），请检查账号密码。`;
};

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const showLocalHint = import.meta.env.DEV && window.location.port === '5173';

  const refreshCaptcha = () => {
    setCaptcha(makeCaptcha());
    setCaptchaInput('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (captchaInput.trim().toUpperCase() !== captcha) {
      alert('验证码不正确，请重新输入。');
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const response = await loginRequest({ username, password });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        onLogin(data.user || { username });
      } else {
        refreshCaptcha();
        alert(getLoginErrorMessage(response, data));
      }
    } catch (error) {
      refreshCaptcha();
      alert(`系统错误：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-stage login-cyber-stage flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-6">
      <div className="login-aurora-layer" aria-hidden="true" />
      <div className="login-matrix-layer" aria-hidden="true" />
      <div className="login-grid-layer" aria-hidden="true" />
      <div className="login-orbit-layer" aria-hidden="true" />
      <div className="login-light-line" aria-hidden="true" />

      <main className="relative z-10 grid min-w-0 w-full max-w-[calc(100vw-2rem)] items-center gap-8 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="hidden min-w-0 text-white lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/80">
            <Sparkles className="h-4 w-4" />
            Infrastructure Intelligence
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight tracking-wide text-white">
            {BRAND.name}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
            统一收束资产、账号凭据、配置备份和自动化纳管状态，让基础设施运行态势在一个控制面内完成闭环。
          </p>
          <div className="mt-10 grid max-w-3xl grid-cols-3 gap-3">
            {[
              ['Assets', '全网资产视图'],
              ['Vault', 'OpenBao 密文托管'],
              ['Backup', '配置版本留存'],
            ].map(([title, body]) => (
              <div key={title} className="login-feature-card">
                <div className="text-lg font-black text-cyan-100">{title}</div>
                <div className="mt-2 text-xs text-slate-400">{body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="login-glass-card min-w-0 w-full max-w-[calc(100vw-2rem)] justify-self-center px-5 py-6 sm:max-w-[420px] sm:px-7 sm:py-7">
          <div className="flex flex-col items-center text-center">
            <div className="login-brand-orb mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-8 w-8 text-cyan-100" />
            </div>
            <div className="brand-display text-2xl font-black text-cyan-100">{BRAND.shortName || BRAND.name}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/70">
              {BRAND.englishName}
            </div>
            <p className="mt-3 text-xs text-slate-400">Secure Operations Console</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <label className="login-field flex h-12 items-center gap-3 px-3">
              <UserRound className="h-4 w-4 text-cyan-200/80" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="账号"
                autoComplete="username"
              />
            </label>

            <label className="login-field flex h-12 items-center gap-3 px-3">
              <LockKeyhole className="h-4 w-4 text-cyan-200/80" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="密码"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-cyan-100"
                title={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </label>

            <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-3 sm:grid-cols-[minmax(0,1fr)_132px]">
              <label className="login-field flex h-12 items-center gap-3 px-3">
                <ShieldCheck className="h-4 w-4 text-cyan-200/80" />
                <input
                  value={captchaInput}
                  onChange={(event) => setCaptchaInput(event.target.value.toUpperCase())}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold uppercase tracking-[0.2em] text-slate-100 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500"
                  placeholder="验证码"
                  maxLength={4}
                />
              </label>
              <button
                type="button"
                onClick={refreshCaptcha}
                className="login-captcha group flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black tracking-[0.22em] text-cyan-100"
                title="点击刷新验证码"
              >
                <span>{captcha}</span>
                <RefreshCw className="h-3.5 w-3.5 opacity-70 transition group-hover:rotate-180" />
              </button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_60px] gap-3 pt-1 sm:grid-cols-[minmax(0,1fr)_auto]">
              <button
                type="submit"
                disabled={loading}
                className="login-button flex h-12 items-center justify-center gap-2 text-sm font-black text-white transition disabled:opacity-60"
              >
                <span>{loading ? '正在登录...' : '登录系统'}</span>
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('');
                  setPassword('');
                  refreshCaptcha();
                }}
                className="login-reset-button h-12 rounded-xl px-4 text-sm font-bold"
              >
                重置
              </button>
            </div>
          </form>

          {showLocalHint ? (
            <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100/80">
              本地预览账号：<span className="font-mono font-bold text-cyan-50">admin</span> /
              <span className="font-mono font-bold text-cyan-50"> pass12345</span>
            </div>
          ) : null}

          <div className="mt-6 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-center text-xs font-semibold text-cyan-100/75">
            OpenBao 密文托管 · 配置版本留痕 · 全链路审计
          </div>
        </section>
      </main>
    </div>
  );
}
