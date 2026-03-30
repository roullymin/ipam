import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Critical Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleClearCacheAndReload = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
          <div className="w-full max-w-2xl rounded-xl border border-red-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3 border-b border-red-100 pb-3 text-red-600">
              <AlertTriangle size={32} />
              <h2 className="text-xl font-bold">系统发生运行时错误 (Runtime Error)</h2>
            </div>

            <p className="mb-4 text-sm text-slate-600">
              React 渲染过程中遇到了未捕获异常，通常与本地缓存结构不匹配或接口返回了非预期数据有关。
            </p>

            <div className="mb-6 max-h-60 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-red-300 shadow-inner">
              <p className="mb-2 border-b border-red-900/50 pb-2 font-bold">
                {this.state.error?.toString()}
              </p>
              <pre className="whitespace-pre-wrap opacity-70">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={this.handleClearCacheAndReload}
                className="flex flex-1 items-center justify-center rounded-lg bg-red-600 px-4 py-3 font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-95"
              >
                <Trash2 size={16} className="mr-2" />
                清除缓存并重载（推荐）
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
              >
                仅刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
