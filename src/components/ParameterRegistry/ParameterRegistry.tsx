/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useDwin } from '../../context/DwinContext';
import { Parameter, DwinDataType, VpRole } from '../../types/dwin';
import { formatVpHex, generateDwinFrame } from '../../utils/hexEngine';
import { 
  Plus, Search, Edit3, Trash2, Copy, AlertTriangle, ExternalLink, 
  Cpu, Hash, CheckCircle2, Sliders, X, ArrowDown, ArrowUp, Check,
  Layers, Monitor
} from 'lucide-react';

const getGroupBadgeClass = (group: string) => {
  const g = group.toLowerCase();
  if (g.includes('chamber') || g.includes('env')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (g.includes('temp') || g.includes('therm')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (g.includes('humid') || g.includes('sensor')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (g.includes('press') || g.includes('safe') || g.includes('alarm')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (g.includes('control') || g.includes('calib')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (g.includes('status') || g.includes('diag')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

const getRoleBadgeClass = (role: VpRole) => {
  switch (role) {
    case 'read_write':
      return 'bg-violet-100/80 text-violet-800 border-violet-300/70';
    case 'read_only':
      return 'bg-sky-100/80 text-sky-800 border-sky-300/70';
    case 'write_only':
      return 'bg-orange-100/80 text-orange-800 border-orange-300/70';
    case 'system_reg':
      return 'bg-amber-100/80 text-amber-800 border-amber-300/70';
    case 'touch_return':
      return 'bg-emerald-100/80 text-emerald-800 border-emerald-300/70';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
};

const formatRoleLabel = (role: VpRole): string => {
  switch (role) {
    case 'read_write':
      return 'Read / Write';
    case 'read_only':
      return 'Read Only';
    case 'write_only':
      return 'Write Only';
    case 'system_reg':
      return 'System Reg';
    case 'touch_return':
      return 'Touch Return';
    default:
      return role;
  }
};

const getRoleCommandBadge = (role: VpRole): string => {
  switch (role) {
    case 'write_only':
      return '0x82';
    case 'read_only':
      return '0x83';
    case 'read_write':
      return '0x82 / 0x83';
    case 'touch_return':
      return '0x84';
    case 'system_reg':
      return '0x80 / 0x81';
    default:
      return '0x82 / 0x83';
  }
};

const getQuickHexPreview = (param: Parameter, headerHex: string): string => {
  try {
    const frame = generateDwinFrame({
      header: headerHex || '5A A5',
      command: param.role === 'read_only' ? 0x83 : 0x82,
      vpAddress: param.vpAddress,
      dataType: param.dataType,
      value: param.defaultValue,
      wordCount: param.words || 1
    });
    return frame.rawHex;
  } catch {
    return `5A A5 05 82 ${(param.vpAddress >> 8).toString(16).padStart(2, '0').toUpperCase()} ${(param.vpAddress & 0xff).toString(16).padStart(2, '0').toUpperCase()} 00 00`;
  }
};

export const ParameterRegistry: React.FC = () => {
  const {
    project,
    addParameter,
    updateParameter,
    deleteParameter,
    duplicateParameter,
    jumpToHexLabWithParam,
    setSelectedScreenId,
    setActiveTab,
    addScreen,
    updateScreen,
    addVpBindingToScreen,
    removeVpBindingFromScreen
  } = useDwin();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<Parameter | null>(null);

  // Active screen for header operations
  const [headerTargetScreenId, setHeaderTargetScreenId] = useState<string>(project.screens[0]?.id || '');

  useEffect(() => {
    if (!project.screens.some(s => s.id === headerTargetScreenId)) {
      if (project.screens.length > 0) {
        setHeaderTargetScreenId(project.screens[0].id);
      }
    }
  }, [project.screens, headerTargetScreenId]);

  // Inline parameter name editing (double-click, no modal)
  const [inlineEditingParamId, setInlineEditingParamId] = useState<string | null>(null);
  const [inlineEditingName, setInlineEditingName] = useState('');

  const handleStartInlineEdit = (param: Parameter) => {
    setInlineEditingParamId(param.id);
    setInlineEditingName(param.name);
  };

  const handleSaveInlineName = (paramId: string) => {
    const trimmed = inlineEditingName.trim();
    if (trimmed) {
      updateParameter(paramId, { name: trimmed });
    }
    setInlineEditingParamId(null);
    setInlineEditingName('');
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingParamId(null);
    setInlineEditingName('');
  };

  // Inline VP address editing (double-click on VP hex, no modal)
  const [inlineEditingVpParamId, setInlineEditingVpParamId] = useState<string | null>(null);
  const [inlineEditingVpHex, setInlineEditingVpHex] = useState('');

  const handleStartInlineVpEdit = (param: Parameter) => {
    setInlineEditingVpParamId(param.id);
    setInlineEditingVpHex(formatVpHex(param.vpAddress));
  };

  const handleSaveInlineVp = (param: Parameter) => {
    const cleanHex = inlineEditingVpHex.trim().replace(/^0x/i, '');
    const parsed = parseInt(cleanHex, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFF) {
      if (parsed !== param.vpAddress) {
        const oldAddress = param.vpAddress;
        updateParameter(param.id, { vpAddress: parsed });
        // Update all screens with this VP binding
        project.screens.forEach(s => {
          if (s.vpBindings.some(b => b.vpAddress === oldAddress)) {
            updateScreen(s.id, {
              vpBindings: s.vpBindings.map(b => b.vpAddress === oldAddress ? { ...b, vpAddress: parsed } : b)
            });
          }
        });
      }
    }
    setInlineEditingVpParamId(null);
    setInlineEditingVpHex('');
  };

  const handleCancelInlineVpEdit = () => {
    setInlineEditingVpParamId(null);
    setInlineEditingVpHex('');
  };

  // Helper to reassign/change screen for a VP address
  const handleScreenChangeForVp = (param: Parameter, targetScreenId: string) => {
    // Unbind from all current screens
    project.screens.forEach(s => {
      const matchingBindings = s.vpBindings.filter(b => b.vpAddress === param.vpAddress);
      matchingBindings.forEach(b => {
        removeVpBindingFromScreen(s.id, b.id);
      });
    });

    // Bind to target screen if chosen
    if (targetScreenId && targetScreenId !== '__CREATE_NEW__') {
      addVpBindingToScreen(targetScreenId, {
        vpAddress: param.vpAddress,
        role: param.role === 'touch_return' ? 'touch_input' : 'data_display',
        label: param.name,
        x: 100,
        y: 100,
        width: 140,
        height: 44,
        notes: `Assigned from Parameter Registry`
      });
    }
  };

  // Optional toggle to test or simulate 1190 sequence being occupied
  const [simulate1190Occupied, setSimulate1190Occupied] = useState(false);

  // Check if a VP address is occupied in project parameters or screen bindings
  const isVpOccupied = (addr: number, words: number = 1): boolean => {
    if (simulate1190Occupied && (addr === 0x1190 || (words > 1 && addr + 2 === 0x1190))) {
      return true;
    }
    for (const p of project.parameters) {
      const pWords = p.words || (p.dataType === 'UINT32' || p.dataType === 'INT32' || p.dataType === 'FLOAT32' ? 2 : 1);
      if (p.vpAddress === addr) return true;
      if (words > 1 && p.vpAddress === addr + 2) return true;
      if (pWords > 1 && (addr >= p.vpAddress && addr < p.vpAddress + pWords * 2)) return true;
    }
    for (const s of project.screens) {
      for (const b of s.vpBindings) {
        if (b.vpAddress === addr) return true;
        if (words > 1 && b.vpAddress === addr + 2) return true;
      }
    }
    return false;
  };

  // Helper to step continuous decimal-hex VP addresses:
  // e.g. 1188 -> 1190. If 1190 sequence is not available (occupied), allocates next sequence 1200.
  const getNextContinuousVp = (
    currentAddr: number,
    step: number,
    wordSize: number,
    allocatedInBatch: Set<number>
  ): number => {
    const hexStr = (currentAddr & 0xffff).toString(16);
    const cleanDigits = hexStr.replace(/[^0-9]/g, '');
    let decVal = cleanDigits.length > 0 ? parseInt(cleanDigits, 10) : currentAddr;

    // Next candidate in continuous decimal numbering (e.g. 1188 + 2 -> 1190)
    let nextDec = decVal + step;
    let candidateHex = parseInt(nextDec.toString(10), 16);

    const isTaken = (hex: number) => isVpOccupied(hex, wordSize) || allocatedInBatch.has(hex);

    // If candidate sequence is not available, jump to next sequence (e.g. 1190 not available -> 1200)
    while (isTaken(candidateHex) || isNaN(candidateHex)) {
      // Jump to start of next sequence/decade (e.g. 1190 -> 1200, 1200 -> 1210 or 1300)
      nextDec = Math.ceil((nextDec + 1) / 10) * 10;
      candidateHex = parseInt(nextDec.toString(10), 16);
      if (candidateHex > 0xFFFF) break;
    }

    return candidateHex;
  };

  // Generate full batch of continuous VP addresses according to continuous decimal-hex rule
  const generateContinuousBatchAddresses = (
    startHexInput: string,
    count: number,
    step: number,
    wordSize: number
  ): number[] => {
    const safeCount = Math.min(Math.max(1, count), 20);
    const rawDigits = startHexInput.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    let startAddr: number;

    if (rawDigits.length > 0) {
      const parsed = parseInt(rawDigits, 16);
      startAddr = (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFF) ? parsed : getNextAvailableVp();
    } else {
      startAddr = getNextAvailableVp();
    }

    const addresses: number[] = [];
    const allocatedInBatch = new Set<number>();

    // Check if initial address is occupied, if so jump to next available sequence
    let current = startAddr;
    if (isVpOccupied(current, wordSize)) {
      const hexStr = (current & 0xffff).toString(16).replace(/[^0-9]/g, '');
      let decVal = hexStr.length > 0 ? parseInt(hexStr, 10) : current;
      while (isVpOccupied(current, wordSize)) {
        decVal = Math.ceil((decVal + 1) / 10) * 10;
        current = parseInt(decVal.toString(10), 16);
        if (current > 0xFFFF) break;
      }
    }

    addresses.push(current);
    allocatedInBatch.add(current);

    for (let i = 1; i < safeCount; i++) {
      const nextAddr = getNextContinuousVp(current, step, wordSize, allocatedInBatch);
      addresses.push(nextAddr);
      allocatedInBatch.add(nextAddr);
      current = nextAddr;
    }

    return addresses;
  };

  // Helper to get next free VP address in continuous sequence
  const getNextAvailableVp = (): number => {
    let highest = 0x1000;
    project.parameters.forEach(p => {
      const hexStr = (p.vpAddress & 0xffff).toString(16).replace(/[^0-9]/g, '');
      const dec = hexStr.length > 0 ? parseInt(hexStr, 10) : p.vpAddress;
      const words = p.words || (p.dataType === 'UINT32' || p.dataType === 'INT32' || p.dataType === 'FLOAT32' ? 2 : 1);
      const endDec = dec + words * 2;
      if (endDec > highest) highest = endDec;
    });
    project.screens.forEach(s => {
      s.vpBindings.forEach(b => {
        const hexStr = (b.vpAddress & 0xffff).toString(16).replace(/[^0-9]/g, '');
        const dec = hexStr.length > 0 ? parseInt(hexStr, 10) : b.vpAddress;
        if (dec + 2 > highest) highest = dec + 2;
      });
    });
    let nextDec = (highest % 2 === 0) ? highest : highest + 1;
    if (nextDec % 10 === 9) nextDec += 1;
    let candidateHex = parseInt(nextDec.toString(10), 16);
    while (isVpOccupied(candidateHex, 1)) {
      nextDec = Math.ceil((nextDec + 1) / 10) * 10;
      candidateHex = parseInt(nextDec.toString(10), 16);
      if (candidateHex > 0xFFFF) break;
    }
    return candidateHex;
  };

  // Helper to safely parse VP address input or fallback to next available sequence address
  const getEffectiveBatchStartAddr = (inputHex: string): number => {
    const digitsOnly = inputHex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    if (!digitsOnly) {
      return getNextAvailableVp();
    }
    const parsed = parseInt(digitsOnly, 16);
    if (isNaN(parsed) || parsed < 0 || parsed > 0xFFFF) {
      return getNextAvailableVp();
    }
    return parsed;
  };

  // Helper to get next free screen number
  const getNextAvailableScreenNumber = (): number => {
    const existing = new Set(project.screens.map(s => s.screenNumber));
    let num = 0;
    while (existing.has(num)) num++;
    return num;
  };

  // Quick Create Screen Modal state
  const [isQuickCreateScreenModalOpen, setIsQuickCreateScreenModalOpen] = useState(false);
  const [quickCreateParamToBind, setQuickCreateParamToBind] = useState<Parameter | null>(null);
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenNumber, setNewScreenNumber] = useState(0);
  const [newScreenGroup, setNewScreenGroup] = useState('Operator UI');

  const handleOpenCreateScreenForParam = (param?: Parameter) => {
    setQuickCreateParamToBind(param || null);
    const nextNum = getNextAvailableScreenNumber();
    setNewScreenNumber(nextNum);
    setNewScreenName(`Screen ${nextNum}`);
    setNewScreenGroup('Operator UI');
    setIsQuickCreateScreenModalOpen(true);
  };

  const handleSaveQuickCreateScreen = (e: React.FormEvent) => {
    e.preventDefault();
    const created = addScreen({
      screenNumber: newScreenNumber,
      name: newScreenName.trim() || `Screen ${newScreenNumber}`,
      group: newScreenGroup.trim() || 'Operator UI',
      resolution: project.resolution,
      bgImageIndex: newScreenNumber,
      bgImageUrl: project.screens[0]?.bgImageUrl || '',
      description: 'Created from Parameter Registry',
      vpBindings: [],
      navigations: []
    });

    setHeaderTargetScreenId(created.id);

    if (quickCreateParamToBind) {
      handleScreenChangeForVp(quickCreateParamToBind, created.id);
    }

    setIsQuickCreateScreenModalOpen(false);
    setQuickCreateParamToBind(null);
  };

  // Add VP for Screen Modal state
  const [isAddVpForScreenModalOpen, setIsAddVpForScreenModalOpen] = useState(false);
  const [targetScreenForAddVp, setTargetScreenForAddVp] = useState<string>(project.screens[0]?.id || '');
  const [newVpName, setNewVpName] = useState('');
  const [newVpIdentifier, setNewVpIdentifier] = useState('');
  const [newVpHex, setNewVpHex] = useState('0x1050');
  const [newVpDataType, setNewVpDataType] = useState<DwinDataType>('UINT16');
  const [newVpWords, setNewVpWords] = useState(1);
  const [newVpUnit, setNewVpUnit] = useState('');
  const [newVpScale, setNewVpScale] = useState(1);
  const [newVpMin, setNewVpMin] = useState(0);
  const [newVpMax, setNewVpMax] = useState(100);
  const [newVpDefault, setNewVpDefault] = useState<string | number>(0);
  const [newVpRole, setNewVpRole] = useState<VpRole>('read_write');
  const [newVpGroup, setNewVpGroup] = useState('Operator UI');
  const [newVpDescription, setNewVpDescription] = useState('');

  const handleOpenAddVpForScreen = (screenId?: string) => {
    const targetId = screenId || headerTargetScreenId || project.screens[0]?.id || '';
    setTargetScreenForAddVp(targetId);
    const nextVp = getNextAvailableVp();
    setNewVpHex(formatVpHex(nextVp));
    setNewVpName('');
    setNewVpIdentifier('');
    setNewVpDataType('UINT16');
    setNewVpWords(1);
    setNewVpUnit('');
    setNewVpScale(1);
    setNewVpMin(0);
    setNewVpMax(100);
    setNewVpDefault(0);
    setNewVpRole('read_write');
    setNewVpGroup('Operator UI');
    setNewVpDescription('');
    setIsAddVpForScreenModalOpen(true);
  };

  const handleSaveAddVpForScreen = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHex = newVpHex.trim().replace(/^0x/i, '');
    const vpAddress = parseInt(cleanHex, 16) || 0x1000;
    const paramName = newVpName.trim() || `VP_${formatVpHex(vpAddress)}`;
    const identifier = newVpIdentifier.trim() || paramName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    addParameter({
      name: paramName,
      identifier,
      vpAddress,
      dataType: newVpDataType,
      words: Number(newVpWords) || 1,
      unit: newVpUnit.trim(),
      scale: Number(newVpScale) || 1,
      min: Number(newVpMin),
      max: Number(newVpMax),
      defaultValue: newVpDefault,
      role: newVpRole,
      group: newVpGroup.trim() || 'Operator UI',
      description: newVpDescription.trim()
    });

    if (targetScreenForAddVp) {
      addVpBindingToScreen(targetScreenForAddVp, {
        vpAddress,
        role: newVpRole === 'touch_return' ? 'touch_input' : 'data_display',
        label: paramName,
        x: 100,
        y: 100,
        width: 140,
        height: 44,
        notes: 'Bound to Screen from Parameter Registry'
      });
    }

    setIsAddVpForScreenModalOpen(false);
  };

  // Batch Add VPs for Screen Modal state
  interface BatchVpItem {
    id: string;
    name: string;
    vpAddressHex: string;
    dataType: DwinDataType;
    role: VpRole;
  }

  const [isBatchVpModalOpen, setIsBatchVpModalOpen] = useState(false);
  const [batchTargetScreenId, setBatchTargetScreenId] = useState<string>(project.screens[0]?.id || '');
  const [batchVpStartHex, setBatchVpStartHex] = useState('0x1070');
  const [batchVpCount, setBatchVpCount] = useState(4);
  const [batchItems, setBatchItems] = useState<BatchVpItem[]>([]);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState('');

  // Helper to re-generate sequence items when start VP or count changes
  const generateBatchItemsFromStart = (startHexInput: string, count: number): BatchVpItem[] => {
    const safeCount = Math.min(Math.max(1, count), 20);
    const addrs = generateContinuousBatchAddresses(startHexInput, safeCount, 2, 1);
    return addrs.map((addr, i) => ({
      id: `batch_item_${i}_${Date.now()}`,
      name: `Parameter ${i + 1}`,
      vpAddressHex: formatVpHex(addr),
      dataType: 'UINT16',
      role: 'read_write'
    }));
  };

  const handleOpenBatchVpForScreen = (screenId?: string) => {
    const targetId = screenId || headerTargetScreenId || project.screens[0]?.id || '';
    setBatchTargetScreenId(targetId);
    const nextVp = getNextAvailableVp();
    const startHex = formatVpHex(nextVp);
    setBatchVpStartHex(startHex);
    setBatchVpCount(4);
    setBatchSuccessMsg('');

    const items = generateBatchItemsFromStart(startHex, 4);
    setBatchItems(items);
    setIsBatchVpModalOpen(true);
  };

  const handleStartHexChange = (newHex: string) => {
    setBatchVpStartHex(newHex);
    setBatchItems(prev => {
      const safeCount = Math.min(Math.max(1, batchVpCount), 20);
      const wordSize = 1;
      const addrs = generateContinuousBatchAddresses(newHex, safeCount, 2, wordSize);
      return addrs.map((addr, i) => ({
        id: prev[i]?.id || `batch_item_${i}_${Date.now()}`,
        name: prev[i]?.name || `Parameter ${i + 1}`,
        vpAddressHex: formatVpHex(addr),
        dataType: prev[i]?.dataType || 'UINT16',
        role: prev[i]?.role || 'read_write'
      }));
    });
  };

  const handleBatchCountChange = (newCount: number) => {
    const safeCount = Math.min(Math.max(1, newCount), 20);
    setBatchVpCount(safeCount);
    setBatchItems(prev => {
      const addrs = generateContinuousBatchAddresses(batchVpStartHex, safeCount, 2, 1);
      return addrs.map((addr, i) => ({
        id: prev[i]?.id || `batch_item_${i}_${Date.now()}`,
        name: prev[i]?.name || `Parameter ${i + 1}`,
        vpAddressHex: prev[i]?.vpAddressHex || formatVpHex(addr),
        dataType: prev[i]?.dataType || 'UINT16',
        role: prev[i]?.role || 'read_write'
      }));
    });
  };

  const handleUpdateBatchItem = (index: number, field: keyof BatchVpItem, value: any) => {
    setBatchItems(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleAutoSequenceReset = () => {
    const nextVp = getNextAvailableVp();
    const nextHex = formatVpHex(nextVp);
    setBatchVpStartHex(nextHex);
    const items = generateBatchItemsFromStart(nextHex, batchVpCount);
    setBatchItems(items);
  };

  const handleExecuteBatchVpForScreen = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchItems.length === 0) return;

    const targetScreen = project.screens.find(s => s.id === batchTargetScreenId);

    batchItems.forEach((item, i) => {
      const cleanHex = item.vpAddressHex.trim().replace(/^0x/i, '');
      const addr = parseInt(cleanHex, 16) || 0x1000;
      const wordSize = (item.dataType === 'UINT32' || item.dataType === 'INT32' || item.dataType === 'FLOAT32') ? 2 : 1;
      const paramName = item.name.trim() || `Parameter ${i + 1}`;
      const identifier = `${paramName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${formatVpHex(addr).replace('0x','')}`;

      addParameter({
        name: paramName,
        identifier,
        vpAddress: addr,
        dataType: item.dataType,
        words: wordSize,
        unit: '',
        scale: 1,
        min: 0,
        max: 100,
        defaultValue: 0,
        role: item.role,
        group: targetScreen?.name || 'Operator UI',
        description: `Batch parameter #${i + 1} allocated with ${item.dataType} and ${formatRoleLabel(item.role)} for ${targetScreen?.name || 'Screen'}.`
      });

      if (batchTargetScreenId) {
        addVpBindingToScreen(batchTargetScreenId, {
          vpAddress: addr,
          role: item.role === 'touch_return' ? 'touch_input' : 'data_display',
          label: paramName,
          x: 100 + (i % 3) * 160,
          y: 100 + Math.floor(i / 3) * 60,
          width: 140,
          height: 44,
          notes: `Batch allocated VP (${item.dataType}, ${formatRoleLabel(item.role)}) for ${targetScreen?.name || 'Screen'}`
        });
      }
    });

    const firstHex = batchItems[0]?.vpAddressHex || '';
    const lastHex = batchItems[batchItems.length - 1]?.vpAddressHex || '';
    setBatchSuccessMsg(`Successfully created and registered ${batchItems.length} parameters (${firstHex} to ${lastHex}) on ${targetScreen?.name || 'screen'}!`);
    setTimeout(() => {
      setIsBatchVpModalOpen(false);
      setBatchSuccessMsg('');
    }, 1200);
  };

  // Form states
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [vpHexInput, setVpHexInput] = useState('0x1000');
  const [dataType, setDataType] = useState<DwinDataType>('UINT16');
  const [words, setWords] = useState(1);
  const [unit, setUnit] = useState('°C');
  const [scale, setScale] = useState(1);
  const [minVal, setMinVal] = useState(0);
  const [maxVal, setMaxVal] = useState(100);
  const [defaultVal, setDefaultVal] = useState<string | number>(25);
  const [role, setRole] = useState<VpRole>('read_write');
  const [group, setGroup] = useState('Thermal Loop');
  const [description, setDescription] = useState('');

  // Groups
  const groups = Array.from(new Set(project.parameters.map(p => p.group))).filter(Boolean);

  // Check for duplicate / overlapping VP addresses
  const vpOccupancy = new Map<number, Parameter[]>();
  project.parameters.forEach(p => {
    for (let i = 0; i < p.words; i++) {
      const addr = p.vpAddress + i;
      const list = vpOccupancy.get(addr) || [];
      list.push(p);
      vpOccupancy.set(addr, list);
    }
  });

  const getOverlapConflict = (param: Parameter): string | null => {
    for (let i = 0; i < param.words; i++) {
      const addr = param.vpAddress + i;
      const list = vpOccupancy.get(addr);
      if (list && list.length > 1) {
        const others = list.filter(p => p.id !== param.id).map(p => `"${p.name}" (${formatVpHex(p.vpAddress)})`);
        if (others.length > 0) {
          return `Overlaps address ${formatVpHex(addr)} with: ${others.join(', ')}`;
        }
      }
    }
    return null;
  };

  const filteredParameters = project.parameters.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      p.identifier.toLowerCase().includes(q) ||
      formatVpHex(p.vpAddress).toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      p.dataType.toLowerCase().includes(q);
    const matchesGroup = selectedGroup === 'all' || p.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleOpenAdd = () => {
    setEditingParam(null);
    const highestVp = project.parameters.reduce((max, p) => Math.max(max, p.vpAddress + p.words), 0x1000);
    setName('');
    setIdentifier('');
    setVpHexInput(formatVpHex(highestVp));
    setDataType('UINT16');
    setWords(1);
    setUnit('');
    setScale(1);
    setMinVal(0);
    setMaxVal(100);
    setDefaultVal(0);
    setRole('read_write');
    setGroup('Thermal Loop');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Parameter) => {
    setEditingParam(p);
    setName(p.name);
    setIdentifier(p.identifier);
    setVpHexInput(formatVpHex(p.vpAddress));
    setDataType(p.dataType);
    setWords(p.words);
    setUnit(p.unit);
    setScale(p.scale);
    setMinVal(p.min);
    setMaxVal(p.max);
    setDefaultVal(p.defaultValue);
    setRole(p.role);
    setGroup(p.group);
    setDescription(p.description);
    setIsModalOpen(true);
  };

  const handleDataTypeChange = (type: DwinDataType) => {
    setDataType(type);
    if (type === 'UINT32' || type === 'INT32' || type === 'FLOAT32') {
      setWords(2);
    } else if (type === 'STRING') {
      setWords(10);
    } else {
      setWords(1);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHex = vpHexInput.trim().replace(/^0x/i, '');
    const vpAddress = parseInt(cleanHex, 16) || 0x1000;

    const payload = {
      name: name.trim() || 'Unnamed Parameter',
      identifier: identifier.trim() || name.toUpperCase().replace(/[^A-Z0-9]/g, '_') || 'PARAM',
      vpAddress,
      dataType,
      words: Number(words) || 1,
      unit: unit.trim(),
      scale: Number(scale) || 1,
      min: Number(minVal),
      max: Number(maxVal),
      defaultValue: defaultVal,
      role,
      group: group.trim() || 'General',
      description: description.trim()
    };

    if (editingParam) {
      updateParameter(editingParam.id, payload);
    } else {
      addParameter(payload);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Parameter Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define each DGUS parameter once. Configure engineering units, word sizes, VP addresses, permitted range, scaling factor, and roles.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Define Parameter</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by parameter name, identifier, VP address (e.g. 0x1000), or unit..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Group Filter */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs shrink-0">
            <button
              onClick={() => setSelectedGroup('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                selectedGroup === 'all'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Groups ({project.parameters.length})
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                  selectedGroup === g
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Parameters Table */}
      <div 
        className="border border-slate-200 rounded-lg overflow-hidden shadow-xs"
        style={{ backgroundColor: '#eaeaea' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 font-semibold text-xs">
                <th className="py-2.5 px-3.5 bg-blue-100/90 text-blue-900 border-l-4 border-l-blue-600 border-r border-blue-200/80 min-w-[280px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-xs uppercase tracking-wider text-blue-950">Screen &amp; VP Address</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Target Screen Dropdown */}
                      <select
                        value={headerTargetScreenId}
                        onChange={e => {
                          if (e.target.value === '__NEW_SCREEN__') {
                            handleOpenCreateScreenForParam();
                          } else {
                            setHeaderTargetScreenId(e.target.value);
                          }
                        }}
                        style={{ width: '300px' }}
                        className="w-[300px] text-[11px] font-semibold text-slate-800 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
                        title="Select screen for VP operations"
                      >
                        {project.screens.map(s => (
                          <option key={s.id} value={s.id}>
                            #{s.screenNumber} {s.name}
                          </option>
                        ))}
                        <option value="__NEW_SCREEN__">+ New Screen...</option>
                      </select>

                      {/* Button: + Add VP */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddVpForScreen(headerTargetScreenId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                        title="Add new VP Address and Parameter for this screen"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add VP</span>
                      </button>

                      {/* Button: ⚡ Batch VPs */}
                      <button
                        type="button"
                        onClick={() => handleOpenBatchVpForScreen(headerTargetScreenId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                        title="Batch generate multiple VP addresses for this screen"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Batch VPs</span>
                      </button>
                    </div>
                  </div>
                </th>
                <th className="py-3 px-4 bg-amber-100/90 text-amber-900 border-l-4 border-l-amber-600 border-r border-amber-200/80">Parameter Name &amp; Key</th>
                <th className="py-3 px-4 bg-cyan-100/90 text-cyan-900 border-l-4 border-l-cyan-600 border-r border-cyan-200/80">Unit &amp; Scaling</th>
                <th className="py-3 px-4 bg-emerald-100/90 text-emerald-950 border-l-4 border-l-emerald-600 border-r border-emerald-200/80">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Lower Limit (Min)</span>
                  </div>
                </th>
                <th className="py-3 px-4 bg-rose-100/90 text-rose-950 border-l-4 border-l-rose-600 border-r border-rose-200/80">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5 text-rose-700" />
                    <span>Upper Limit (Max)</span>
                  </div>
                </th>
                <th className="py-3 px-4 bg-violet-100/90 text-violet-900 border-l-4 border-l-violet-600 border-r border-violet-200/80">Role &amp; DWIN Cmd</th>
                <th className="py-3 px-4 bg-slate-200/90 text-slate-800 border-l-4 border-l-slate-600 text-right">Actions &amp; HEX Frame</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParameters.map((param, idx) => {
                const conflict = getOverlapConflict(param);
                const boundScreens = project.screens.filter(s =>
                  s.vpBindings && s.vpBindings.some(vp => vp.vpAddress === param.vpAddress)
                );
                return (
                  <tr
                    key={param.id}
                    className={`transition-colors hover:bg-blue-50/40 ${
                      conflict ? 'bg-amber-50/60' : idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                    }`}
                  >
                    {/* VP Address (Blue Theme - Left Margin Blue) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-blue-500 border-r border-slate-100">
                      {/* Screen assignment dropdown */}
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <select
                          value={boundScreens[0]?.id || ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '__CREATE_NEW__') {
                              handleOpenCreateScreenForParam(param);
                            } else {
                              handleScreenChangeForVp(param, val);
                            }
                          }}
                          className="text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[190px] truncate shadow-2xs"
                          title="Change assigned screen for this VP address"
                        >
                          <option value="">-- No Screen (Unbound) --</option>
                          {project.screens.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (#{s.screenNumber})
                            </option>
                          ))}
                          <option value="__CREATE_NEW__">+ Create New Screen...</option>
                        </select>

                        {boundScreens[0] && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedScreenId(boundScreens[0].id);
                              setActiveTab('screens');
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                            title={`Jump to screen: ${boundScreens[0].name}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 font-mono">
                        {inlineEditingVpParamId === param.id ? (
                          <div className="flex items-center gap-1 py-0.5">
                            <input
                              type="text"
                              autoFocus
                              value={inlineEditingVpHex}
                              onChange={e => setInlineEditingVpHex(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveInlineVp(param);
                                } else if (e.key === 'Escape') {
                                  handleCancelInlineVpEdit();
                                }
                              }}
                              onBlur={() => handleSaveInlineVp(param)}
                              className="w-20 px-2 py-0.5 font-mono font-bold text-xs text-blue-950 bg-white border-2 border-blue-500 rounded-md shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              placeholder="0x1000"
                            />
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => handleSaveInlineVp(param)}
                              className="p-1 rounded bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors shrink-0 cursor-pointer"
                              title="Save VP Address (Enter)"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={handleCancelInlineVpEdit}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                              title="Cancel (Esc)"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span 
                            onDoubleClick={() => handleStartInlineVpEdit(param)}
                            style={{ fontSize: '14px' }}
                            className="font-mono font-bold text-[14px] px-2.5 py-0.5 rounded-md bg-blue-100/80 text-blue-800 border border-blue-300/70 shadow-2xs cursor-pointer hover:bg-blue-200/80 hover:border-blue-400 transition-all inline-flex items-center gap-1 group"
                            title="Double-click to change VP address inline (no modal)"
                          >
                            <span>{formatVpHex(param.vpAddress)}</span>
                            <Edit3 className="w-3 h-3 text-blue-400 group-hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        )}
                        {param.words > 1 && (
                          <span className="text-[10px] text-blue-600 font-mono">
                            ..{formatVpHex(param.vpAddress + param.words - 1)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {param.words} {param.words === 1 ? 'word' : 'words'} ({param.words * 2}B)
                      </div>
                      {conflict && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 font-medium mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[180px]" title={conflict}>{conflict}</span>
                        </div>
                      )}
                    </td>

                    {/* Name & Key (Amber Theme - Left Margin Amber) */}
                    <td className="py-3 px-4 border-l-4 border-l-amber-500 border-r border-slate-100">
                      {inlineEditingParamId === param.id ? (
                        <div className="flex items-center gap-1.5 py-0.5">
                          <input
                            type="text"
                            autoFocus
                            value={inlineEditingName}
                            onChange={e => setInlineEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveInlineName(param.id);
                              } else if (e.key === 'Escape') {
                                handleCancelInlineEdit();
                              }
                            }}
                            onBlur={() => handleSaveInlineName(param.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-white border-2 border-amber-500 rounded-md shadow-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-full min-w-[140px] max-w-[240px]"
                            placeholder="Parameter name..."
                          />
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleSaveInlineName(param.id)}
                            className="p-1 rounded bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors shrink-0 cursor-pointer"
                            title="Save Name (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={handleCancelInlineEdit}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                            title="Cancel (Esc)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDoubleClick={() => handleStartInlineEdit(param)}
                          className="font-semibold text-slate-900 hover:text-amber-800 cursor-pointer group flex items-center gap-1.5 transition-colors py-0.5 rounded px-1 -mx-1 hover:bg-amber-50/70"
                          title="Double-click to edit name inline (no modal)"
                        >
                          <span>{param.name}</span>
                          <Edit3 className="w-3 h-3 text-slate-300 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      )}
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                        {param.identifier}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.2 rounded-full border ${getGroupBadgeClass(param.group)}`}>
                          {param.group}
                        </span>
                      </div>
                    </td>

                    {/* Unit & Scale (Cyan Theme - Left Margin Cyan) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-cyan-500 border-r border-slate-100">
                      <span className="inline-flex items-center font-semibold text-xs px-2.5 py-0.5 rounded-md bg-cyan-100/80 text-cyan-800 border border-cyan-300/70">
                        {param.unit || 'Unitless'}
                      </span>
                      <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                        Scale: 1 / {param.scale}
                        {param.scale > 1 && (
                          <span className="text-cyan-600"> (res 0.{(1 / param.scale).toString().slice(2)})</span>
                        )}
                      </div>
                    </td>

                    {/* Lower Limit (Emerald Theme - Left Margin Emerald) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-emerald-500 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 shadow-2xs">
                          <ArrowDown className="w-3 h-3 text-emerald-600" />
                          <span>{param.min}</span>
                        </span>
                        {param.unit && (
                          <span className="text-[11px] text-emerald-700 font-medium">{param.unit}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Minimum limit
                      </div>
                    </td>

                    {/* Upper Limit (Rose Theme - Left Margin Rose) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-rose-500 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-0.5 rounded-md bg-rose-100/90 text-rose-800 border border-rose-300/80 shadow-2xs">
                          <ArrowUp className="w-3 h-3 text-rose-600" />
                          <span>{param.max}</span>
                        </span>
                        {param.unit && (
                          <span className="text-[11px] text-rose-700 font-medium">{param.unit}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Default: <span className="font-mono font-semibold text-slate-700">{param.defaultValue}</span>
                      </div>
                    </td>

                    {/* Role & DWIN Command (Violet Theme - Left Margin Violet) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-violet-500 border-r border-slate-100">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center font-mono text-[11px] px-2.5 py-0.5 rounded-md border font-medium ${getRoleBadgeClass(param.role)}`}>
                          {formatRoleLabel(param.role)}
                        </span>
                        <span 
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200 font-bold"
                          title={`DWIN Command: ${param.role === 'read_only' ? '0x83 (Read VP)' : param.role === 'write_only' ? '0x82 (Write VP)' : '0x82 (Write VP) / 0x83 (Read VP)'}`}
                        >
                          {getRoleCommandBadge(param.role)}
                        </span>
                      </div>
                    </td>

                    {/* Actions & HEX Lab (Slate Theme - Left Margin Slate) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap border-l-4 border-l-slate-400">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => jumpToHexLabWithParam(param)}
                          className="px-2.5 py-1 text-xs text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50/70 rounded hover:bg-blue-100 flex items-center gap-1 font-medium transition-colors"
                          title="Generate or Test HEX Frame for this Parameter"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>HEX Lab</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(param)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          title="Edit Parameter"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateParameter(param.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          title="Duplicate Parameter"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            deleteParameter(param.id);
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                          title="Delete Parameter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Second line: Hex Value frame preview */}
                      <div className="flex items-center justify-end mt-1.5">
                        <div
                          onClick={() => jumpToHexLabWithParam(param)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs font-semibold"
                          title={`Click to load into HEX Lab: ${getQuickHexPreview(param, project.headerHex)}`}
                        >
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-medium">HEX:</span>
                          <span style={{ fontSize: '14px' }} className="text-[14px] font-mono tracking-wide">
                            {getQuickHexPreview(param, project.headerHex)}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredParameters.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No parameters match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parameter Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full p-6 sm:p-8 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingParam ? `Edit Parameter: ${editingParam.name}` : 'Define New DGUS Parameter'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Parameter Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Target Temperature"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (!identifier || identifier.startsWith('PARAM_')) {
                        setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Identifier (C Macro / Key)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CMD_TARGET_TEMP"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    VP Address (Hex)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0x1000"
                    value={vpHexInput}
                    onChange={e => setVpHexInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Type
                  </label>
                  <select
                    value={dataType}
                    onChange={e => handleDataTypeChange(e.target.value as DwinDataType)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  >
                    <option value="UINT16">UINT16 (1 word / 2 bytes)</option>
                    <option value="INT16">INT16 (Signed 1 word)</option>
                    <option value="UINT32">UINT32 (2 words / 4 bytes)</option>
                    <option value="INT32">INT32 (Signed 2 words)</option>
                    <option value="FLOAT32">FLOAT32 (IEEE-754 4 bytes)</option>
                    <option value="STRING">STRING (ASCII/GBK variable)</option>
                    <option value="BITFIELD">BITFIELD (16-bit status mask)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Words Allocated
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={words}
                    onChange={e => setWords(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Engineering Unit
                  </label>
                  <input
                    type="text"
                    placeholder="°C, RPM, bar, ms, %, etc."
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Scale Factor (1 = 1:1, 10 = 0.1 res)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={scale}
                    onChange={e => setScale(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Minimum Allowed
                  </label>
                  <input
                    type="number"
                    value={minVal}
                    onChange={e => setMinVal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Maximum Allowed
                  </label>
                  <input
                    type="number"
                    value={maxVal}
                    onChange={e => setMaxVal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Default Initial Value
                  </label>
                  <input
                    type="text"
                    value={defaultVal}
                    onChange={e => setDefaultVal(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    VP Role
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as VpRole)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  >
                    <option value="read_write">Read &amp; Write (Setpoint / Interactive)</option>
                    <option value="read_only">Read Telemetry (Sensor / Calculated)</option>
                    <option value="write_only">Write Pulse / Command</option>
                    <option value="system_reg">DWIN System Register (0x0000 - 0x00FF)</option>
                    <option value="touch_return">Touch Return Keycode / Keypad buffer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Group / Subsystem
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thermal Loop, Motion, Pneumatics"
                    value={group}
                    onChange={e => setGroup(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Description &amp; Embedded Implementation Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Detail protocol word alignment, calibration, or DGUS config notes..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  {editingParam ? 'Save Changes' : 'Create Parameter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Screen Modal */}
      {isQuickCreateScreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Monitor className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Create New Screen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCreateScreenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCreateScreen} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Screen / Pic Number (#)
                </label>
                <input
                  type="number"
                  min="0"
                  max="65535"
                  required
                  value={newScreenNumber}
                  onChange={e => setNewScreenNumber(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Screen Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alarm History, Motor Control"
                  value={newScreenName}
                  onChange={e => setNewScreenName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 font-semibold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Subsystem / Group
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operator UI, Setup, Diagnostics"
                  value={newScreenGroup}
                  onChange={e => setNewScreenGroup(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-900 bg-white"
                />
              </div>

              {quickCreateParamToBind && (
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  <span>Will immediately assign parameter <strong>{quickCreateParamToBind.name}</strong> ({formatVpHex(quickCreateParamToBind.vpAddress)}) to this new screen.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateScreenModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Create Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add VP for Selected Screen Modal */}
      {isAddVpForScreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New VP Address for Screen
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define a new variable pointer and bind it directly to the target screen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVpForScreenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddVpForScreen} className="space-y-3.5 text-xs">
              {/* Target Screen selector + create new */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Assign To Screen
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetScreenForAddVp}
                    onChange={e => setTargetScreenForAddVp(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded border border-slate-300 bg-white font-semibold text-slate-900"
                  >
                    {project.screens.map(s => (
                      <option key={s.id} value={s.id}>
                        Screen #{s.screenNumber} - {s.name} ({s.group})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateScreenForParam()}
                    className="px-2.5 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium whitespace-nowrap"
                  >
                    + New Screen
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Parameter Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tank Pressure"
                    value={newVpName}
                    onChange={e => {
                      setNewVpName(e.target.value);
                      if (!newVpIdentifier) {
                        setNewVpIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 font-mono">
                    VP Address (Hex)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0x1050"
                    value={newVpHex}
                    onChange={e => setNewVpHex(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-blue-400 bg-blue-50/50 font-mono font-bold text-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Data Type
                  </label>
                  <select
                    value={newVpDataType}
                    onChange={e => {
                      const dt = e.target.value as DwinDataType;
                      setNewVpDataType(dt);
                      if (dt === 'UINT32' || dt === 'INT32' || dt === 'FLOAT32') {
                        setNewVpWords(2);
                      } else {
                        setNewVpWords(1);
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                  >
                    <option value="UINT16">UINT16 (16-bit Unsigned)</option>
                    <option value="INT16">INT16 (16-bit Signed)</option>
                    <option value="UINT32">UINT32 (32-bit Unsigned)</option>
                    <option value="INT32">INT32 (32-bit Signed)</option>
                    <option value="FLOAT32">FLOAT32 (32-bit Float)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PSI, bar, °C, RPM"
                    value={newVpUnit}
                    onChange={e => setNewVpUnit(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Role
                  </label>
                  <select
                    value={newVpRole}
                    onChange={e => setNewVpRole(e.target.value as VpRole)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                  >
                    <option value="read_write">Read / Write (0x82 / 0x83)</option>
                    <option value="read_only">Read Only (0x83)</option>
                    <option value="write_only">Write Only (0x82)</option>
                    <option value="touch_return">Touch Jump / Keycode (0x84)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Min Value
                  </label>
                  <input
                    type="number"
                    value={newVpMin}
                    onChange={e => setNewVpMin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Max Value
                  </label>
                  <input
                    type="number"
                    value={newVpMax}
                    onChange={e => setNewVpMax(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Default Initial
                  </label>
                  <input
                    type="text"
                    value={newVpDefault}
                    onChange={e => setNewVpDefault(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddVpForScreenModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs"
                >
                  Add VP &amp; Bind to Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add VPs for Selected Screen Modal */}
      {isBatchVpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Batch Add VPs for Screen
                  </h3>
                  <p className="text-xs text-slate-500">
                    Directly customize and generate sequential VP addresses and register them to your selected screen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchVpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {batchSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{batchSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleExecuteBatchVpForScreen} className="space-y-4 text-xs">
              {/* Target screen selector & Sequence start controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                {/* Column 1: Target Screen */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between h-5 mb-1">
                    <label className="block text-slate-700 font-semibold">
                      Target Screen
                    </label>
                  </div>
                  <div className="flex items-center gap-2 h-9">
                    <select
                      value={batchTargetScreenId}
                      onChange={e => setBatchTargetScreenId(e.target.value)}
                      style={{ width: '150px' }}
                      className="w-[150px] shrink-0 h-full px-3 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 shadow-2xs text-xs"
                    >
                      {project.screens.map(s => (
                        <option key={s.id} value={s.id}>
                          Screen #{s.screenNumber} - {s.name} ({s.group})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateScreenForParam()}
                      className="h-full px-3 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold whitespace-nowrap text-xs transition-colors"
                    >
                      + New Screen
                    </button>
                  </div>
                  <div className="h-4 mt-1 flex items-center">
                    <span className="text-[10px] text-slate-400">Target screen for VP bindings</span>
                  </div>
                </div>

                {/* Column 2: Start VP Address */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between h-5 mb-1">
                    <label className="block text-slate-700 font-semibold font-mono">
                      Start VP Address (Hex)
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoSequenceReset}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-mono font-bold hover:underline"
                      title="Auto-detect next sequential free VP address"
                    >
                      Next: {formatVpHex(getNextAvailableVp())}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 h-9">
                    <input
                      type="text"
                      required
                      value={batchVpStartHex}
                      onChange={e => handleStartHexChange(e.target.value)}
                      placeholder={formatVpHex(getNextAvailableVp())}
                      style={{ width: '141px', fontSize: '14px' }}
                      className="w-[141px] shrink-0 h-full px-3 rounded-lg border border-indigo-300 bg-indigo-50/50 font-mono font-bold text-indigo-950 text-[14px] shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleAutoSequenceReset}
                      className="h-full px-2.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-mono font-bold text-[11px] border border-indigo-300 whitespace-nowrap transition-colors"
                      title="Allocate next free sequence address"
                    >
                      Auto Sequence
                    </button>
                  </div>
                  <div className="h-4 mt-1 flex items-center">
                    {(() => {
                      const rawDigits = batchVpStartHex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
                      const effAddr = getEffectiveBatchStartAddr(batchVpStartHex);
                      const occupiedBy = project.parameters.find(p => p.vpAddress === effAddr);
                      if (rawDigits.length === 0) {
                        return (
                          <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>No numbers in input. Allocated: {formatVpHex(effAddr)}.</span>
                          </span>
                        );
                      }
                      if (occupiedBy) {
                        return (
                          <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{formatVpHex(effAddr)} in use ({occupiedBy.name}). Next: {formatVpHex(getNextAvailableVp())}</span>
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] text-emerald-600 font-medium font-mono">
                          Sequence starts at {formatVpHex(effAddr)}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Column 3: Number of VPs */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between h-5 mb-1">
                    <label className="block text-slate-700 font-semibold">
                      Number of VPs
                    </label>
                  </div>
                  <div className="h-9">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      required
                      value={batchVpCount}
                      onChange={e => handleBatchCountChange(parseInt(e.target.value) || 1)}
                      style={{ width: '80px' }}
                      className="w-[80px] h-full px-3 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-center shadow-2xs text-xs"
                    />
                  </div>
                  <div className="h-4 mt-1 flex items-center">
                    <span className="text-[10px] text-slate-400">1 to 20 sequential VPs</span>
                  </div>
                </div>
              </div>

              {/* Continuous Sequence Allocation Section with Direct Edit Columns */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-bold text-xs uppercase tracking-wider">
                      Continuous Sequence Allocation
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px]">
                      {batchItems.length} VPs
                    </span>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={simulate1190Occupied}
                      onChange={e => {
                        setSimulate1190Occupied(e.target.checked);
                        setTimeout(() => handleStartHexChange(batchVpStartHex), 50);
                      }}
                      className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="font-medium">Simulate 1190 in use &rarr; Jump 1200</span>
                  </label>
                </div>

                {/* Direct Edit Table Column View */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3">Parameter Name</th>
                        <th className="py-2 px-3 w-36 font-mono">VP Address (Hex)</th>
                        <th className="py-2 px-3 w-40 font-mono">Data Type</th>
                        <th className="py-2 px-3 w-40">Read / Write Role</th>
                        <th className="py-2 px-3 w-20 text-center">Cmd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchItems.map((item, i) => {
                        const cleanHex = item.vpAddressHex.trim().replace(/^0x/i, '');
                        const parsedAddr = parseInt(cleanHex, 16);
                        const wordSize = (item.dataType === 'UINT32' || item.dataType === 'INT32' || item.dataType === 'FLOAT32') ? 2 : 1;
                        const occupied = !isNaN(parsedAddr) && isVpOccupied(parsedAddr, wordSize);

                        return (
                          <tr
                            key={item.id || i}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              occupied ? 'bg-amber-50/50' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                              #{i + 1}
                            </td>

                            {/* Direct edit: Parameter Name */}
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                required
                                value={item.name}
                                onChange={e => handleUpdateBatchItem(i, 'name', e.target.value)}
                                placeholder={`Parameter ${i + 1}`}
                                className="w-full px-2.5 py-1 rounded border border-slate-300 focus:border-indigo-500 bg-white font-semibold text-slate-900 text-xs shadow-2xs"
                              />
                            </td>

                            {/* Direct edit: VP Address (Hex) */}
                            <td className="py-1.5 px-3">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  required
                                  value={item.vpAddressHex}
                                  onChange={e => handleUpdateBatchItem(i, 'vpAddressHex', e.target.value)}
                                  placeholder="0x1190"
                                  style={{ fontSize: '14px' }}
                                  className={`w-full px-2.5 py-1 rounded border font-mono font-bold text-[14px] shadow-2xs ${
                                    occupied
                                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                                      : 'border-indigo-300 bg-indigo-50/40 text-indigo-950'
                                  }`}
                                />
                                {occupied && (
                                  <span title="Address occupied by existing parameter or binding" className="absolute right-2 flex items-center pointer-events-none">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Direct edit: Data Type */}
                            <td className="py-1.5 px-3">
                              <select
                                value={item.dataType}
                                onChange={e => handleUpdateBatchItem(i, 'dataType', e.target.value as DwinDataType)}
                                className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-xs text-slate-900 font-semibold shadow-2xs"
                              >
                                <option value="UINT16">UINT16 (16-bit)</option>
                                <option value="INT16">INT16 (Signed)</option>
                                <option value="UINT32">UINT32 (32-bit)</option>
                                <option value="INT32">INT32 (Signed 32)</option>
                                <option value="FLOAT32">FLOAT32 (Float)</option>
                                <option value="BITFIELD">BITFIELD (Mask)</option>
                              </select>
                            </td>

                            {/* Direct edit: Read / Write Role */}
                            <td className="py-1.5 px-3">
                              <select
                                value={item.role}
                                onChange={e => handleUpdateBatchItem(i, 'role', e.target.value as VpRole)}
                                className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs text-slate-900 font-medium shadow-2xs"
                              >
                                <option value="read_write">Read / Write</option>
                                <option value="read_only">Read Only</option>
                                <option value="write_only">Write Only</option>
                                <option value="touch_return">Touch Return</option>
                              </select>
                            </td>

                            {/* Live Badge: DWIN Command */}
                            <td className="py-2 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded bg-violet-100 text-violet-800 font-mono text-[10px] font-bold border border-violet-200">
                                {getRoleCommandBadge(item.role)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBatchVpModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  <span>Generate &amp; Register {batchItems.length} VPs</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
