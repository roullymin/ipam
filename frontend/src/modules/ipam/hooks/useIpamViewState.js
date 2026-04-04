import { useCallback, useMemo, useState } from 'react';

export function useIpamViewState() {
  const [ipViewMode, setIpViewMode] = useState('list');
  const [selectedSubnetId, setSelectedSubnetId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  return {
    ipViewMode,
    setIpViewMode,
    selectedSubnetId,
    setSelectedSubnetId,
    expandedSections,
    setExpandedSections,
    searchQuery,
    setSearchQuery,
    tagFilter,
    setTagFilter,
  };
}

export function useIpamViewActions({
  selectedSubnetId,
  safeFetch,
  refreshData,
  alert,
  extractResponseMessage,
  setIsIPModalOpen,
  setEditingIP,
  setIpFormData,
}) {
  const [isScanning, setIsScanning] = useState(false);

  const handleScanSubnet = useCallback(async () => {
    if (!selectedSubnetId) return;
    if (!window.confirm('确定立即开始子网扫描吗？')) return;

    setIsScanning(true);
    try {
      const response = await safeFetch('/api/scan/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet_id: selectedSubnetId }),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '子网扫描失败'));
      }
      const data = await response.json();
      alert(data.message || '子网扫描完成。');
      refreshData();
    } catch (error) {
      alert(`子网扫描失败：${error.message}`);
    } finally {
      setIsScanning(false);
    }
  }, [alert, extractResponseMessage, refreshData, safeFetch, selectedSubnetId]);

  const handlePoolIPClick = useCallback((item) => {
    if (item.id) {
      setEditingIP(item);
      setIpFormData(item);
    } else {
      setEditingIP(null);
      setIpFormData({
        ip_address: item.ip || item.ip_address,
        status: item.status === 'free' ? 'offline' : item.status,
      });
    }
    setIsIPModalOpen(true);
  }, [setEditingIP, setIpFormData, setIsIPModalOpen]);

  return {
    isScanning,
    handleScanSubnet,
    handlePoolIPClick,
  };
}

export function useIpamDerivedData({
  ips,
  subnets,
  selectedSubnetId,
  searchQuery,
  tagFilter,
}) {
  const currentSubnet = useMemo(
    () => subnets.find((subnet) => String(subnet.id) === String(selectedSubnetId)) || {},
    [selectedSubnetId, subnets],
  );

  const filteredIPs = useMemo(() => {
    const selectedKey = selectedSubnetId == null ? null : String(selectedSubnetId);
    return ips.filter((ip) => {
      const matchSubnet = selectedKey == null ? true : String(ip.subnet) === selectedKey;
      const matchSearch = searchQuery ? JSON.stringify(ip).toLowerCase().includes(searchQuery.toLowerCase()) : true;
      const matchTag = tagFilter ? ip.tag === tagFilter : true;
      return matchSubnet && matchSearch && matchTag;
    });
  }, [ips, searchQuery, selectedSubnetId, tagFilter]);

  const uniqueTags = useMemo(() => {
    const tags = new Set();
    ips.forEach((ip) => {
      if (ip.tag) tags.add(ip.tag);
    });
    return Array.from(tags);
  }, [ips]);

  return {
    currentSubnet,
    filteredIPs,
    uniqueTags,
  };
}
