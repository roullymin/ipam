import { useCallback, useEffect, useState } from 'react';

import { safeFetch } from '../lib/api';


const unwrapListResponse = async (response, fallback = []) => {
  const data = await response.json().catch(() => fallback);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return fallback;
};

const parseIps = (items = []) =>
  items.map((ip) => {
    const tagRegex = /__TAG__:(.*)$/m;
    const lockRegex = /__LOCKED__:(true|false)/m;
    let tag = ip.tag || '';
    let description = ip.description || '';
    let isLocked = false;

    const lockMatch = description.match(lockRegex);
    if (lockMatch) {
      isLocked = lockMatch[1] === 'true';
      description = description.replace(lockRegex, '').trim();
    }

    const tagMatch = description.match(tagRegex);
    if (tagMatch) {
      tag = tagMatch[1];
      description = description.replace(tagRegex, '').trim();
    }

    return {
      ...ip,
      description,
      tag,
      is_locked: isLocked,
      status: isLocked ? 'online' : ip.status,
    };
  });

const parseRacks = (items = [], safeInt) =>
  items.map((rack) => {
    const pduMetaRegex = /__PDU_META__:({.*})$/m;
    let description = rack.description || '';
    let pduCount = 2;
    let pduPower = 0;

    const match = description.match(pduMetaRegex);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        pduCount = safeInt(meta.count, 2);
        pduPower = safeInt(meta.power, 0);
      } catch (error) {
        console.warn('Failed to parse rack PDU metadata', error);
      }
      description = description.replace(pduMetaRegex, '').trim();
    }

    return {
      ...rack,
      description,
      pdu_count: pduCount,
      pdu_power: pduPower,
    };
  });

const parseDevices = (items = [], safeInt) =>
  items.map((device) => {
    const metaRegex = /__META__:({.*})$/;
    const cleanDevice = {
      ...device,
      position: safeInt(device.position, 1),
      u_height: safeInt(device.u_height, 1),
      power_usage: safeInt(device.power_usage, 0),
      typical_power: safeInt(device.typical_power, 0),
    };

    if (cleanDevice.specs && metaRegex.test(cleanDevice.specs)) {
      try {
        const match = cleanDevice.specs.match(metaRegex);
        const meta = JSON.parse(match[1]);
        return {
          ...cleanDevice,
          ...meta,
          specs: cleanDevice.specs.replace(metaRegex, '').trim(),
        };
      } catch (error) {
        console.warn('Failed to parse device metadata', error);
      }
    }

    return cleanDevice;
  });

export function useAppDataLoader({
  activeTab,
  isLoggedIn,
  activeLocation,
  setActiveLocation,
  selectedSubnetId,
  setSelectedSubnetId,
  safeInt,
}) {
  const [sections, setSections] = useState([]);
  const [subnets, setSubnets] = useState([]);
  const [ips, setIps] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backupSummary, setBackupSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [residentStaff, setResidentStaff] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [datacenters, setDatacenters] = useState([]);
  const [racks, setRacks] = useState([]);
  const [rackDevices, setRackDevices] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const refreshData = useCallback(
    async (targetTab = activeTab) => {
      setIsDataLoading(true);
      try {
        const requests = [];
        const addRequest = (key, url) => requests.push([key, safeFetch(url)]);

        if (targetTab === 'dashboard') {
          addRequest('ips', '/api/ips/');
          addRequest('residentStaff', '/api/resident-staff/');
          addRequest('loginLogs', '/api/logs/');
          addRequest('datacenters', '/api/datacenters/');
          addRequest('racks', '/api/racks/');
          addRequest('rackDevices', '/api/rack-devices/');
        }

        if (targetTab === 'list') {
          addRequest('sections', '/api/sections/');
          addRequest('subnets', '/api/subnets/');
          addRequest('ips', '/api/ips/');
        }

        if (targetTab === 'dcim') {
          addRequest('datacenters', '/api/datacenters/');
          addRequest('racks', '/api/racks/');
          addRequest('rackDevices', '/api/rack-devices/');
        }

        if (targetTab === 'security') {
          addRequest('loginLogs', '/api/logs/');
          addRequest('auditLogs', '/api/audit-logs/');
          addRequest('blocklist', '/api/blocklist/');
        }

        if (targetTab === 'resident') {
          addRequest('residentStaff', '/api/resident-staff/');
        }

        if (targetTab === 'backup') {
          addRequest('backups', '/api/list-backups/');
          addRequest('backupSummary', '/api/backup/summary/');
        }

        if (targetTab === 'users') {
          addRequest('users', '/api/users/');
        }

        const responses = Object.fromEntries(
          await Promise.all(requests.map(async ([key, promise]) => [key, await promise]))
        );

        if (responses.sections?.ok) {
          setSections(await unwrapListResponse(responses.sections));
        }

        if (responses.subnets?.ok) {
          const subnetData = await unwrapListResponse(responses.subnets);
          setSubnets(subnetData);
          if (!selectedSubnetId && subnetData.length > 0) {
            setSelectedSubnetId(subnetData[0].id);
          }
        }

        if (responses.ips?.ok) {
          setIps(parseIps(await unwrapListResponse(responses.ips)));
        }

        if (responses.users?.ok) {
          setUsers(await unwrapListResponse(responses.users));
        }

        if (responses.residentStaff?.ok) {
          setResidentStaff(await unwrapListResponse(responses.residentStaff));
        }

        if (responses.backups?.ok) {
          setBackups(await unwrapListResponse(responses.backups));
        }

        if (responses.backupSummary?.ok) {
          const summary = await responses.backupSummary.json().catch(() => null);
          setBackupSummary(summary || null);
        }

        if (responses.loginLogs?.ok) {
          setLoginLogs(await unwrapListResponse(responses.loginLogs));
        }

        if (responses.auditLogs?.ok) {
          setAuditLogs(await unwrapListResponse(responses.auditLogs));
        }

        if (responses.blocklist?.ok) {
          setBlocklist(await unwrapListResponse(responses.blocklist));
        }

        if (responses.datacenters?.ok) {
          const datacenterData = await unwrapListResponse(responses.datacenters);
          setDatacenters(datacenterData);
          if (!activeLocation && datacenterData.length > 0) {
            setActiveLocation(datacenterData[0].id);
          }
        }

        if (responses.racks?.ok) {
          setRacks(parseRacks(await unwrapListResponse(responses.racks), safeInt));
        }

        if (responses.rackDevices?.ok) {
          setRackDevices(parseDevices(await unwrapListResponse(responses.rackDevices), safeInt));
        }
      } catch (error) {
        console.error('Data load failed', error);
      } finally {
        setIsDataLoading(false);
      }
    },
    [activeLocation, activeTab, safeInt, selectedSubnetId, setActiveLocation, setSelectedSubnetId]
  );

  useEffect(() => {
    if (isLoggedIn) {
      refreshData(activeTab);
    }
  }, [activeTab, isLoggedIn, refreshData]);

  return {
    sections,
    subnets,
    ips,
    backups,
    backupSummary,
    users,
    residentStaff,
    loginLogs,
    auditLogs,
    blocklist,
    datacenters,
    racks,
    rackDevices,
    isDataLoading,
    refreshData,
  };
}
