import React from 'react';

import IPPoolGrid from '../../../components/IPPoolGrid';

export default function IpPoolPanel({ ips, subnetId, onIPClick }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-lg font-black text-slate-900">地址池视图</div>
        <div className="mt-1 text-sm text-slate-500">点击空闲地址可快速录入，点击已用地址可查看或编辑。</div>
      </div>
      <div className="custom-scrollbar overflow-auto">
        <IPPoolGrid ips={ips} subnetId={subnetId} onIPClick={onIPClick} />
      </div>
    </div>
  );
}
