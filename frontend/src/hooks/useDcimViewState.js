import { useCallback, useMemo, useRef, useState } from 'react';

export function useDcimViewState() {
  const [dcimViewMode, setDcimViewMode] = useState('list');
  const [elevationLayout, setElevationLayout] = useState('horizontal');
  const [activeLocation, setActiveLocation] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [currentRackForm, setCurrentRackForm] = useState(null);
  const [currentDcForm, setCurrentDcForm] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [viewState, setViewState] = useState({ scale: 0.74 });

  const elevationScrollRef = useRef(null);
  const elevationContentRef = useRef(null);
  const elevationDragInfo = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const handleZoomIn = useCallback(() => {
    setViewState((prev) => ({ ...prev, scale: Math.min(prev.scale + 0.06, 0.9) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState((prev) => ({ ...prev, scale: Math.max(prev.scale - 0.06, 0.56) }));
  }, []);

  const handleZoomReset = useCallback(() => {
    setViewState({ scale: 0.74 });
  }, []);

  const handleElevationMouseDown = useCallback((event) => {
    const element = elevationScrollRef.current;
    if (!element) return;
    elevationDragInfo.current.isDown = true;
    elevationDragInfo.current.startX = event.pageX - element.offsetLeft;
    elevationDragInfo.current.startY = event.pageY - element.offsetTop;
    elevationDragInfo.current.scrollLeft = element.scrollLeft;
    elevationDragInfo.current.scrollTop = element.scrollTop;
    element.style.cursor = 'grabbing';
  }, []);

  const handleElevationMouseLeave = useCallback(() => {
    elevationDragInfo.current.isDown = false;
    if (elevationScrollRef.current) elevationScrollRef.current.style.cursor = 'grab';
  }, []);

  const handleElevationMouseUp = useCallback(() => {
    elevationDragInfo.current.isDown = false;
    if (elevationScrollRef.current) elevationScrollRef.current.style.cursor = 'grab';
  }, []);

  const handleElevationMouseMove = useCallback((event) => {
    if (!elevationDragInfo.current.isDown) return;
    event.preventDefault();
    const element = elevationScrollRef.current;
    if (!element) return;
    const x = event.pageX - element.offsetLeft;
    const y = event.pageY - element.offsetTop;
    const walkX = (x - elevationDragInfo.current.startX) * 1.2;
    const walkY = (y - elevationDragInfo.current.startY) * 1.2;
    element.scrollLeft = elevationDragInfo.current.scrollLeft - walkX;
    element.scrollTop = elevationDragInfo.current.scrollTop - walkY;
  }, []);

  const handleJumpToDc = useCallback((dcId, setActiveTab) => {
    setActiveTab('dcim');
    setActiveLocation(dcId);
  }, []);

  return {
    dcimViewMode,
    setDcimViewMode,
    elevationLayout,
    setElevationLayout,
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
    viewState,
    elevationScrollRef,
    elevationContentRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleElevationMouseDown,
    handleElevationMouseLeave,
    handleElevationMouseUp,
    handleElevationMouseMove,
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
