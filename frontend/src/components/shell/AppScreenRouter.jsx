import React from 'react';

import { DatacenterChangeRequestView } from '../../modules/changeRequests';
import { DashboardView } from '../../modules/dashboard';
import { DcimView } from '../../modules/dcim';
import { IpamView } from '../../modules/ipam';
import { ResidentManagementView } from '../../modules/resident';
import { BackupView } from '../../modules/backup';
import { SecurityCenterView } from '../../modules/security';
import { UserManagementView } from '../../modules/users';

export default function AppScreenRouter(props) {
  const {
    activeTab,
    dashboardProps,
    ipamProps,
    dcimProps,
    residentProps,
    securityProps,
    backupProps,
    usersProps,
  } = props;

  if (activeTab === 'dashboard') {
    return <DashboardView {...dashboardProps} />;
  }

  if (activeTab === 'list') {
    return <IpamView {...ipamProps} />;
  }

  if (activeTab === 'dcim') {
    return <DcimView {...dcimProps} />;
  }

  if (activeTab === 'changes') {
    return <DatacenterChangeRequestView />;
  }

  if (activeTab === 'security') {
    return <SecurityCenterView {...securityProps} />;
  }

  if (activeTab === 'resident') {
    return <ResidentManagementView {...residentProps} />;
  }

  if (activeTab === 'backup') {
    return <BackupView {...backupProps} />;
  }

  if (activeTab === 'users') {
    return <UserManagementView {...usersProps} />;
  }

  return null;
}
