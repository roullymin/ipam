import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
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
    <div className="login-stage min-h-screen flex items-center justify-center px-6 py-10">
      <div className="ambient-orb ambient-orb-a"></div>
      <div className="ambient-orb ambient-orb-b"></div>
      <div className="login-card relative z-10 w-full max-w-sm rounded-[28px] p-8">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">IP 台账管理系统</h1>
          <p className="mt-2 text-sm text-slate-500">
            让地址、机房和资产台账稳定地运行在同一套工作台里。
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">账号</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-700"
          >
            {loading ? '登录中...' : '进入系统'}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500">
          当前版本会优先保留现有账号和业务数据，再逐步补齐更适合生产环境的认证、角色、审计和强制改密能力。
        </div>
      </div>
    </div>
  );
}
