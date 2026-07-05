import React, { useState } from 'react';
import {
  ArrowRight,
  DatabaseBackup,
  Eye,
  KeyRound,
  LockKeyhole,
  Network,
  ServerCog,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { BRAND } from '../lib/brand';
import { loginRequest } from '../lib/api';

const MODULE_ROWS = [
  { icon: Network, label: 'IPAM', value: '地址与网段' },
  { icon: ServerCog, label: 'DCIM', value: '机房与设备' },
  { icon: KeyRound, label: 'Vault', value: '账号与凭据' },
  { icon: DatabaseBackup, label: 'Backup', value: '配置与版本' },
];

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const showLocalHint = import.meta.env.DEV && window.location.port === '5173';

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await loginRequest({ username, password });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        onLogin(data.user || { username });
      } else {
        alert(getLoginErrorMessage(response, data));
      }
    } catch (error) {
      alert(`系统错误：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-stage login-cyber-stage flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-6">
      <div className="login-matrix-layer" aria-hidden="true" />
      <div className="login-grid-layer" aria-hidden="true" />
      <div className="login-light-line" aria-hidden="true" />

      <main className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-6">
        <section className="login-glass-card w-full max-w-[420px] px-7 py-7">
          <div className="flex flex-col items-center text-center">
            <div className="login-brand-orb mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-7 w-7 text-cyan-100" />
            </div>
            <div className="brand-display text-xl font-black text-cyan-100">{BRAND.shortName || BRAND.name}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/60">
              {BRAND.englishName}
            </div>
            <p className="mt-2 text-xs text-slate-400">Orchestrate Assets, Passwords and Config Backups</p>
          </div>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
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
                <Eye className="h-4 w-4" />
              </button>
            </label>

            <div className="grid grid-cols-[1fr_96px] gap-3">
              <label className="login-field flex h-12 items-center gap-3 px-3">
                <ShieldCheck className="h-4 w-4 text-cyan-200/80" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="校验码"
                  defaultValue="116"
                />
              </label>
              <div className="login-captcha flex h-12 items-center justify-center rounded-xl text-sm font-black tracking-[0.3em] text-cyan-100">
                116
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3 pt-1">
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
                }}
                className="login-reset-button h-12 rounded-xl px-4 text-sm font-bold"
              >
                重置
              </button>
            </div>
          </form>

          {showLocalHint ? (
            <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100/80">
              本地预览账号：<span className="font-mono font-bold text-cyan-50">admin</span> /
              <span className="font-mono font-bold text-cyan-50"> pass12345</span>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2">
            {MODULE_ROWS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="login-module-tile">
                <Icon className="h-4 w-4 text-cyan-200" />
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-100">{label}</div>
                  <div className="truncate text-[11px] text-slate-500">{value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-center text-xs font-semibold text-cyan-100/75">
            星图之眼，收束基础设施运行态势
          </div>
        </section>
      </main>
    </div>
  );
}
