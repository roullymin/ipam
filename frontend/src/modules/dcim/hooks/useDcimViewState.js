import { useCallback, useMemo, useState } from 'react';

export function useDcimViewState() {
  const [activeLocation, setActiveLocation] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [currentRackForm, setCurrentRackForm] = useState(null);
  const [currentDcForm, setCurrentDcForm] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  const handleJumpToDc = useCallback((dcId, setActiveTab) => {
    setActiveTab('dcim');
    setActiveLocation(dcId);
  }, []);

  return {
    activeLocation,
    setActiveLocation,
    selectedRack,
    setSelectedRack,
    currentRackForm,
    setCurrentRackForm,
    currentDcForm,
    setCurrentDcForm,
    editingDevice,
    setEditingDevice,
    handleJumpToDc,
  };
}

export function useDcimDerivedData({
  racks,
  activeLocation,
  getRackCalculatedPower,
  safeInt,
}) {
  const currentRacks = useMemo(
    () => racks.filter((rack) => String(rack.datacenter) === String(activeLocation)),
    [activeLocation, racks],
  );

  const datacenterPowerStats = useMemo(() => {
    return currentRacks.reduce(
      (acc, rack) => {
        const rackStats = getRackCalculatedPower(rack.id);
        return {
          total_rated: acc.total_rated + rackStats.rated_sum,
          total_typical: acc.total_typical + rackStats.typical_sum,
          total_pdu: acc.total_pdu + safeInt(rack.pdu_power, 0),
        };
      },
      { total_rated: 0, total_typical: 0, total_pdu: 0 },
    );
  }, [currentRacks, getRackCalculatedPower, safeInt]);

  return {
    currentRacks,
    datacenterPowerStats,
  };
}
