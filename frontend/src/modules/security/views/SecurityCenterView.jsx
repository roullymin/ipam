import React from 'react';

import {
  AuditTimelinePanel,
  BlocklistPanel,
  LoginAuditPanel,
  SecurityOverview,
} from '../components';

const formatTime = (value) => {
  if (!value) return '未记录';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return String(value);
  }
};

const actionLabels = {
  create: '创建',
  update: '更新',
  delete: '删除',
  unlock: '解锁',
  approve: '通过',
  reject: '驳回',
  import: '导入',
  export: '导出',
  download_template: '下载模板',
  change_password: '修改密码',
  trigger_backup: '执行备份',
  scan: '扫描',
};

const moduleLabels = {
  network_section: '网络分区',
  subnet: '子网',
  ip_address: 'IP 资产',
  user: '用户',
  blocklist: '黑名单',
  datacenter: '机房',
  rack: '机柜',
  rack_device: '设备',
  resident_staff: '驻场人员',
  system: '系统',
  backup: '备份',
  dcim: '机房设备',
};

export default function SecurityCenterView({
  loginLogs = [],
  blocklist = [],
  auditLogs = [],
  onOpenBlockModal,
  onUnblock,
}) {
  const failedLogins = loginLogs.filter((log) => String(log.status || '').toLowerCase() !== 'success').length;

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <SecurityOverview
          loginLogs={loginLogs}
          blocklist={blocklist}
          auditLogs={auditLogs}
          failedLogins={failedLogins}
          onOpenBlockModal={onOpenBlockModal}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <LoginAuditPanel loginLogs={loginLogs} formatTime={formatTime} />
          <BlocklistPanel blocklist={blocklist} onUnblock={onUnblock} />
          <AuditTimelinePanel
            auditLogs={auditLogs}
            formatTime={formatTime}
            actionLabels={actionLabels}
            moduleLabels={moduleLabels}
          />
        </div>
      </div>
    </div>
  );
}
