import React, { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  DatabaseBackup,
  KeyRound,
  LockKeyhole,
  Network,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';

import { BRAND } from '../lib/brand';
import { loginRequest } from '../lib/api';

const MODULE_ROWS = [
  { icon: Boxes, label: '资产中心', value: '设备 / 配置 / 密码' },
  { icon: Network, label: '网络地址', value: 'IPAM / 网段 / 地址' },
  { icon: ServerCog, label: '机房设备', value: '机柜 / U 位 / 功率' },
  { icon: DatabaseBackup, label: '备份恢复', value: '配置备份 / 版本' },
];

const getLoginErrorMessage = (response, data) => {
  if (data?.message || data?.detail) {
    return data.message || data.detail;
  }
  if (response.status === 0) {
    return '无法连接后端服务，请检查 backend 容器日志和运行环境配置。';
  }
  if ([502, 503, 504].includes(response.status)) {
    return '后端服务尚未就绪，请检查密钥、数据库迁移和容器日志。';
  }
  if (response.status === 429) {
    return '登录尝试过于频繁，请稍后再试。';
  }
  if (response.status === 403) {
    return '登录请求被安全策略拒绝，请检查来源 IP 和 HTTPS 配置。';
  }
  return `登录失败（HTTP ${response.status || '未知'}），请检查账号密码或联系管理员。`;
};

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const showLocalHint = import.meta.env.DEV && window.location.port === '5173';

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await loginRequest({ username, password });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onLogin(data.user || { username });
      } else {
        alert(getLoginErrorMessage(res, data));
      }
    } catch (error) {
      alert(`系统错误：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-stage flex min-h-[100dvh] items-center justify-center px-4 py-6 md:px-8">
      <div className="login-stage-inner flex w-full justify-center">
        <div className="login-shell grid w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white">
          <section className="login-hero flex flex-col justify-between px-6 py-7 md:px-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-blue-100">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-base font-black text-white">{BRAND.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase text-slate-400">{BRAND.englishName}</div>
                  <div className="mt-1 text-xs text-slate-400">{BRAND.tagline}</div>
                </div>
              </div>

              <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold uppercase text-blue-100/70">Infrastructure Console</div>
                <h1 className="mt-2 text-2xl font-black text-white">{BRAND.workspaceLabel}</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                  面向运维团队统一管理网络地址、机房设备、密码台账、备份恢复和审计流程。
                </p>
              </div>

              <div className="mt-5 grid gap-2">
                {MODULE_ROWS.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="login-scope-row">
                    <Icon className="h-4 w-4 text-blue-200" />
                    <span className="font-semibold text-white">{label}</span>
                    <span className="ml-auto truncate text-xs text-slate-400">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                企业内部系统，操作记录将进入审计链路
              </div>
            </div>
          </section>

          <section className="login-panel flex items-center px-6 py-8 md:px-10">
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-7">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xs font-bold uppercase text-slate-500">安全登录</div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">登录平台</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">请输入平台账号和密码。</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">账号</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="login-input h-11 w-full px-3 text-sm outline-none"
                    placeholder="请输入用户名"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="login-input h-11 w-full px-3 text-sm outline-none"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="login-button flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-white transition"
                >
                  <span>{loading ? '正在登录...' : '进入系统'}</span>
                  {!loading ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              </form>

              {showLocalHint ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                  本地预览账号：<span className="font-mono font-bold text-slate-700">admin</span> / <span className="font-mono font-bold text-slate-700">pass12345</span>
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                <KeyRound className="h-4 w-4 text-slate-400" />
                忘记密码请联系平台管理员重置。
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
