import React from 'react';
import { Activity, Plus, ShieldCheck, ScrollText } from 'lucide-react';

const formatTime = (value) => {
  if (!value) return 'Not recorded';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const actionLabels = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  unlock: 'Unlock',
  approve: 'Approve',
  reject: 'Reject',
  import: 'Import',
  export: 'Export',
  download_template: 'Download Template',
  change_password: 'Change Password',
  trigger_backup: 'Run Backup',
  scan: 'Scan',
};

const moduleLabels = {
  network_section: 'Network Section',
  subnet: 'Subnet',
  ip_address: 'IP Asset',
  user: 'User',
  blocklist: 'Blocklist',
  datacenter: 'Datacenter',
  rack: 'Rack',
  rack_device: 'Device',
  resident_staff: 'Resident Staff',
  system: 'System',
  backup: 'Backup',
  dcim: 'DCIM',
};

const EmptyState = ({ text }) => (
  <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">{text}</div>
);

export default function SecurityCenterView({
  loginLogs = [],
  blocklist = [],
  auditLogs = [],
  onOpenBlockModal,
  onUnblock,
}) {
  return (
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-500">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 xl:grid-cols-3">
        <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div>
              <h3 className="flex items-center text-base font-bold text-slate-800">
                <Activity className="mr-2 h-4 w-4 text-blue-500" />
                Login Audit
              </h3>
              <p className="mt-1 text-xs text-slate-500">Track login time, source IP, and outcome for each account sign-in.</p>
            </div>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {loginLogs.length === 0 ? (
              <EmptyState text="No login audit records yet." />
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold">Time</th>
                    <th className="px-6 py-3 font-semibold">User</th>
                    <th className="px-6 py-3 font-semibold">Source IP</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginLogs.map((log) => {
                    const success = String(log.status || '').toLowerCase() === 'success';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{formatTime(log.timestamp)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{log.username || 'Unknown user'}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.ip_address || '-'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              success
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div>
              <h3 className="flex items-center text-base font-bold text-slate-800">
                <ShieldCheck className="mr-2 h-4 w-4 text-red-500" />
                Blocklist
              </h3>
              <p className="mt-1 text-xs text-slate-500">Review blocked or suspicious source addresses in one place.</p>
            </div>
            <button
              onClick={onOpenBlockModal}
              className="inline-flex items-center rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700"
              type="button"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Block IP
            </button>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {blocklist.length === 0 ? (
              <EmptyState text="No blocked addresses." />
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold">Blocked IP</th>
                    <th className="px-6 py-3 font-semibold">Reason</th>
                    <th className="px-6 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blocklist.map((block) => (
                    <tr key={block.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-red-600">{block.ip_address}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{block.reason || 'No reason provided'}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onUnblock(block.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                          type="button"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div>
              <h3 className="flex items-center text-base font-bold text-slate-800">
                <ScrollText className="mr-2 h-4 w-4 text-indigo-500" />
                Audit Trail
              </h3>
              <p className="mt-1 text-xs text-slate-500">Track sensitive changes, approvals, and bulk import or export actions.</p>
            </div>
          </div>
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
            {auditLogs.length === 0 ? (
              <EmptyState text="No audit records yet." />
            ) : (
              auditLogs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition-colors hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {(log.actor_name || 'System')} performed
                        <span className="mx-1 text-blue-600">{actionLabels[log.action] || log.action}</span>
                        action
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Module: {moduleLabels[log.module] || log.module || 'System'} · Target: {log.target_display || log.target_type || 'Unspecified'}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs font-mono text-slate-400">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                  {(log.detail || log.ip_address) && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      {log.detail ? <div>{log.detail}</div> : null}
                      {log.ip_address ? <div className="mt-1 font-mono">Source IP: {log.ip_address}</div> : null}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
