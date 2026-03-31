import React, { useState } from 'react';
import { ChevronDown, Lock, Settings, X } from 'lucide-react';

const DEFAULT_STATUS_STYLES = {
  online: {
    label: '在线使用',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  active: {
    label: '正常在用',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  offline: {
    label: '离线停用',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  rogue: {
    label: '异常违规',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  reserved: {
    label: '保留地址',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  free: {
    label: '空闲地址',
    bg: 'bg-white',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-300',
  },
  maintenance: {
    label: '维护中',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  planned: {
    label: '规划中',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  retired: {
    label: '已退役',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  locked: {
    label: '已锁定',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
};

export const FormInput = ({ label, required, className = '', ...props }) => (
  <div className="mb-4">
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
      {label}
      {required ? (
        <span className="ml-1 text-red-500" title="必填字段">
          *
        </span>
      ) : null}
    </label>
    <input
      {...props}
      className={`w-full rounded-xl border px-3 py-2.5 text-sm text-slate-700 outline-none transition-all ${
        required && !props.value && props.value !== ''
          ? 'border-red-200'
          : 'border-slate-300 focus:border-blue-500'
      } ${
        props.disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
          : 'bg-white focus:ring-2 focus:ring-blue-100'
      } ${className}`}
    />
  </div>
);

export const SmartInput = ({ label, listId, options, onManage, required, ...props }) => (
  <div className="relative mb-4">
    <div className="mb-1.5 flex items-center justify-between">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      {onManage ? (
        <button
          onClick={onManage}
          className="flex items-center text-[10px] text-blue-500 hover:text-blue-700 hover:underline"
          title="管理可选项"
          type="button"
        >
          <Settings className="mr-1 h-3 w-3" />
          管理选项
        </button>
      ) : null}
    </div>
    <div className="group relative">
      <input
        list={listId}
        {...props}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm text-slate-700 outline-none ${
          required && !props.value ? 'border-red-200' : 'border-slate-300 focus:border-blue-500'
        } bg-white focus:ring-2 focus:ring-blue-100`}
        placeholder={props.placeholder || '请选择或手动输入'}
      />
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
    <datalist id={listId}>
      {(options || []).map((option, index) => (
        <option key={index} value={typeof option === 'object' ? option.value : option} />
      ))}
    </datalist>
  </div>
);

export const StatusBadge = ({ status, isLocked, styles }) => {
  const mergedStyles = styles || DEFAULT_STATUS_STYLES;
  const normalizedStatus = status || 'offline';
  const style =
    (isLocked && mergedStyles.locked) ||
    mergedStyles[normalizedStatus] ||
    mergedStyles.offline ||
    DEFAULT_STATUS_STYLES.offline;

  if (isLocked) {
    return (
      <span
        className={`flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${style.bg} ${style.text} ${style.border}`}
        title="连续登录失败达到阈值后会锁定，需要管理员手动解锁或等待锁定时间结束。"
      >
        <Lock className="mr-1.5 h-2.5 w-2.5" />
        {style.label}
      </span>
    );
  }

  return (
    <span
      className={`flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${style.dot}`}></span>
      {style.label}
    </span>
  );
};

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
      <div
        className={`animate-in fade-in zoom-in duration-200 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-2xl ${
          sizeClasses[size] || sizeClasses.md
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="custom-scrollbar overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export const DebugModal = ({ isOpen, onClose, logs, onClear }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="系统调试日志">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">这里记录最近的接口请求和调试信息，方便排查线上问题。</p>
        <button onClick={onClear} className="text-xs text-red-500 hover:underline" type="button">
          清空日志
        </button>
      </div>
      <div className="custom-scrollbar h-96 space-y-3 overflow-y-auto rounded-lg bg-slate-900 p-4 font-mono text-xs shadow-inner">
        {logs.length === 0 ? <div className="mt-20 text-center text-slate-500">暂无日志</div> : null}
        {logs.map((log) => (
          <div key={log.id} className="border-b border-slate-800 pb-2 last:border-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-slate-400 opacity-60">[{log.time}]</span>
              <span
                className={`font-bold ${
                  log.type === 'error'
                    ? 'text-red-400'
                    : log.type === 'success'
                      ? 'text-green-400'
                      : 'text-blue-400'
                }`}
              >
                {log.action}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-all border-l-2 border-slate-700 pl-4 leading-relaxed text-slate-300 opacity-90">
              {typeof log.content === 'object' ? JSON.stringify(log.content, null, 2) : log.content}
            </pre>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export const NotificationCenter = ({ items = [], onDismiss }) => {
  if (!items.length) return null;

  const toneMap = {
    success: {
      card: 'border-emerald-200 bg-emerald-50/95',
      title: 'text-emerald-800',
      body: 'text-emerald-700',
      button: 'text-emerald-500 hover:bg-emerald-100',
      dot: 'bg-emerald-500',
    },
    error: {
      card: 'border-rose-200 bg-rose-50/95',
      title: 'text-rose-800',
      body: 'text-rose-700',
      button: 'text-rose-500 hover:bg-rose-100',
      dot: 'bg-rose-500',
    },
    warning: {
      card: 'border-amber-200 bg-amber-50/95',
      title: 'text-amber-800',
      body: 'text-amber-700',
      button: 'text-amber-500 hover:bg-amber-100',
      dot: 'bg-amber-500',
    },
    info: {
      card: 'border-cyan-200 bg-cyan-50/95',
      title: 'text-cyan-800',
      body: 'text-cyan-700',
      button: 'text-cyan-500 hover:bg-cyan-100',
      dot: 'bg-cyan-500',
    },
  };

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3">
      {items.map((item) => {
        const tone = toneMap[item.type] || toneMap.info;
        return (
          <div
            key={item.id}
            className={`pointer-events-auto overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm ${tone.card}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${tone.dot}`}></span>
              <div className="min-w-0 flex-1">
                {item.title ? (
                  <div className={`text-sm font-bold ${tone.title}`}>{item.title}</div>
                ) : null}
                <div className={`text-sm leading-6 ${tone.body}`}>{item.message}</div>
              </div>
              <button
                onClick={() => onDismiss?.(item.id)}
                className={`rounded-xl p-1 transition-colors ${tone.button}`}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ConfirmActionModal = ({
  isOpen,
  title,
  message,
  confirmLabel = '确认',
  tone = 'danger',
  onCancel,
  onConfirm,
}) => {
  const confirmTone =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
      : 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title || '请确认操作'} size="sm">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
          {message || '请确认是否继续执行此操作。'}
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
            type="button"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors ${confirmTone}`}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const OptionManagerModal = ({ title, options, onSave, onClose }) => {
  const initialList =
    Array.isArray(options) && typeof options[0] === 'object'
      ? options.map((option) => option.label || option.value)
      : Array.isArray(options)
        ? options
        : [];

  const [list, setList] = useState(initialList);
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const value = newItem.trim();
    if (value && !list.includes(value)) {
      setList([...list, value]);
      setNewItem('');
    }
  };

  const handleDelete = (item) => {
    if (window.confirm('确定要删除这个选项吗？')) {
      setList(list.filter((entry) => entry !== item));
    }
  };

  const handleSave = () => {
    if (title === 'deviceTypes' || title.includes('设备类型')) {
      onSave(list.map((label) => ({ value: label, label })));
    } else {
      onSave(list);
    }
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`管理选项：${title}`}>
      <div className="space-y-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="输入新选项"
            onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white"
            type="button"
          >
            添加
          </button>
        </div>

        <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {list.map((item, index) => (
            <div key={index} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
              <span className="text-sm">{item}</span>
              <button
                onClick={() => handleDelete(item)}
                className="text-slate-400 hover:text-red-500"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
            type="button"
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
};
