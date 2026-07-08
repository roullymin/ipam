import React, { Suspense, lazy } from 'react';

const DashboardView = lazy(() => import('../../modules/dashboard/views/DashboardView'));
const AssetCenterView = lazy(() => import('../../modules/assets/views/AssetCenterView'));
const IpamView = lazy(() => import('../../modules/ipam/views/IpamView'));
const DcimView = lazy(() => import('../../modules/dcim/views/DcimView'));
const DatacenterChangeRequestView = lazy(
  () => import('../../modules/changeRequests/views/DatacenterChangeRequestView'),
);
const ResidentManagementView = lazy(
  () => import('../../modules/resident/views/ResidentManagementView'),
);
const BackupView = lazy(() => import('../../modules/backup/views/BackupView'));
const SecurityCenterView = lazy(
  () => import('../../modules/security/views/SecurityCenterView'),
);
const UserManagementView = lazy(
  () => import('../../modules/users/views/UserManagementView'),
);
const VaultView = lazy(() => import('../../modules/vault/views/VaultView'));

export default function AppScreenRouter(props) {
  const {
    activeTab,
    currentRole,
    dashboardProps,
    assetProps,
    ipamProps,
    dcimProps,
    residentProps,
    changesProps,
    securityProps,
    backupProps,
    usersProps,
  } = props;

  let screen = null;
  if (activeTab === 'dashboard') screen = <DashboardView {...dashboardProps} />;
  if (activeTab === 'assets') screen = <AssetCenterView {...assetProps} />;
  if (activeTab === 'list') screen = <IpamView {...ipamProps} />;
  if (activeTab === 'dcim') screen = <DcimView {...dcimProps} />;
  if (activeTab === 'changes') screen = <DatacenterChangeRequestView {...changesProps} />;
  if (activeTab === 'security') screen = <SecurityCenterView {...securityProps} />;
  if (activeTab === 'resident') screen = <ResidentManagementView {...residentProps} />;
  if (activeTab === 'vault') screen = <VaultView currentRole={currentRole} />;
  if (activeTab === 'backup') screen = <BackupView {...backupProps} />;
  if (activeTab === 'users') screen = <UserManagementView {...usersProps} />;

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          正在加载页面...
        </div>
      }
    >
      {screen}
    </Suspense>
  );
}
