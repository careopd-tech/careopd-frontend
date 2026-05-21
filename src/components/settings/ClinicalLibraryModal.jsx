import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Loader2, Pin, Plus, Save, Search, Trash2, X } from 'lucide-react';
import Modal from '../ui/Modal';
import AlertMessage from '../ui/AlertMessage';
import API_BASE_URL from '../../config';

const normalizeText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ');

const normalizeKey = (value) => normalizeText(value).toLowerCase();

const ClinicalLibraryModal = ({
  clinicId,
  isOpen,
  onClose,
  title,
  itemType,
  items = [],
  onCatalogUpdate
}) => {
  const supportsPin = itemType !== 'drug';
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKeys, setEditingKeys] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingGroups, setPendingGroups] = useState([]);
  const [groupSlots, setGroupSlots] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [pinningKey, setPinningKey] = useState('');
  const [deletingKey, setDeletingKey] = useState('');
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [savedOrderKeys, setSavedOrderKeys] = useState([]);
  const listRef = useRef(null);

  const actionButtonClass = 'w-7 h-7 rounded-md transition-colors inline-flex items-center justify-center flex-shrink-0';
  const inlineInputClass = 'type-body h-9 px-3 rounded-lg outline-none border transition-colors';

  const getItemKey = (item) => String(
    item.tempId ||
    item._id ||
    item.seedKey ||
    item.normalizedLabel ||
    `${itemType}-${item.label || ''}-${item.group || item.category || ''}`
  );

  const getItemGroup = (item) => normalizeText(item.group || item.category || 'General') || 'General';
  const getPendingGroupKey = (groupId) => `pending-${groupId}`;
  const buildGroupSlots = (catalogItems = []) => {
    const slots = [];
    const seen = new Set();

    catalogItems.forEach((item, index) => {
      const groupName = getItemGroup(item);
      const normalizedName = normalizeKey(groupName);
      if (seen.has(normalizedName)) return;

      seen.add(normalizedName);
      slots.push({
        slotId: normalizedName || `group-${index}`,
        name: groupName,
        pendingGroupId: ''
      });
    });

    return slots;
  };

  const getInitialOrderedItems = (catalogItems = []) => catalogItems.slice();

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setEditingKeys([]);
    setDrafts({});
    setPendingItems([]);
    setPendingGroups([]);
    setGroupSlots(buildGroupSlots(items));
    setExpandedGroups({ General: true });
    setError('');
    setSavingKey('');
    setPinningKey('');
    setDeletingKey('');
    setConfirmDeleteItem(null);
    setSavedOrderKeys(getInitialOrderedItems(items).map(getItemKey));
  }, [isOpen, itemType]);

  useEffect(() => {
    if (!isOpen) return;

    setSavedOrderKeys((prev) => {
      const currentKeys = new Set([
        ...items.map(getItemKey),
        ...pendingItems.map(getItemKey)
      ]);
      const retainedKeys = prev.filter((key) => currentKeys.has(key));
      const retainedSet = new Set(retainedKeys);
      const missingKeys = getInitialOrderedItems(items)
        .map(getItemKey)
        .filter((key) => !retainedSet.has(key));

      if (retainedKeys.length === prev.length && missingKeys.length === 0) {
        return prev;
      }

      return [...retainedKeys, ...missingKeys];
    });
  }, [items, pendingItems, isOpen, itemType]);

  useEffect(() => {
    if (!isOpen) return;

    setGroupSlots((prev) => {
      const next = [...prev];
      let changed = false;

      items.forEach((item, index) => {
        const groupName = getItemGroup(item);
        const normalizedName = normalizeKey(groupName);
        const existingIndex = next.findIndex((slot) => normalizeKey(slot.name) === normalizedName);

        if (existingIndex >= 0) {
          if (!next[existingIndex].name && groupName) {
            next[existingIndex] = { ...next[existingIndex], name: groupName };
            changed = true;
          }
          return;
        }

        next.push({
          slotId: normalizedName || `group-${index}`,
          name: groupName,
          pendingGroupId: ''
        });
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [items, isOpen, itemType]);

  const displayItems = useMemo(() => {
    const pendingDisplayItems = pendingItems.map((item) => ({ ...item, isNew: true }));
    const savedDisplayItems = items.map((item) => ({ ...item, isNew: false }));
    const itemMap = new Map([
      ...savedDisplayItems.map((item) => [getItemKey(item), item]),
      ...pendingDisplayItems.map((item) => [getItemKey(item), item])
    ]);
    const orderedKeys = savedOrderKeys.length > 0
      ? savedOrderKeys
      : getInitialOrderedItems(items).map(getItemKey);
    const orderedKeySet = new Set(orderedKeys);
    const orderedDisplayItems = [
      ...orderedKeys.map((key) => itemMap.get(key)).filter(Boolean),
      ...[...pendingDisplayItems, ...savedDisplayItems].filter((item) => !orderedKeySet.has(getItemKey(item)))
    ];

    return orderedDisplayItems;
  }, [items, pendingItems, savedOrderKeys]);

  const groupedCatalog = useMemo(() => {
    const groupMap = new Map();
    const groupOrder = [];

    const ensureGroup = (key, name, extras = {}) => {
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          id: key,
          name,
          items: [],
          pendingGroupId: extras.pendingGroupId || '',
          isPendingGroup: Boolean(extras.pendingGroupId)
        });
        groupOrder.push(key);
      } else if (name && !groupMap.get(key).name) {
        groupMap.get(key).name = name;
      }
      return groupMap.get(key);
    };

    groupSlots.forEach((slot) => {
      ensureGroup(slot.slotId, slot.name, { pendingGroupId: slot.pendingGroupId || '' });
    });

    displayItems.forEach((item) => {
      const groupName = getItemGroup(item);
      const matchingSlot = groupSlots.find((slot) => normalizeKey(slot.name) === normalizeKey(groupName));
      const groupKey = matchingSlot?.slotId || normalizeKey(groupName) || 'general';
      ensureGroup(groupKey, groupName).items.push(item);
    });

    return groupOrder.map((key) => groupMap.get(key)).filter(Boolean);
  }, [displayItems, groupSlots]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = normalizeKey(searchQuery);

    return groupedCatalog
      .map((group) => {
        const groupMatch = normalizedSearch
          ? normalizeKey(group.name).includes(normalizedSearch)
          : true;
        const visibleItems = normalizedSearch
          ? (groupMatch
              ? group.items
              : group.items.filter((item) => normalizeKey(item.label).includes(normalizedSearch)))
          : group.items;

        const shouldShow = normalizedSearch
          ? groupMatch || visibleItems.length > 0
          : true;

        return shouldShow ? { ...group, visibleItems } : null;
      })
      .filter(Boolean);
  }, [groupedCatalog, searchQuery]);

  const isSearchMode = normalizeKey(searchQuery).length > 0;
  const hasEditingGroup = pendingGroups.some((group) => group.isEditing);

  const resetDraftForKey = (key) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openInlineEditor = (item) => {
    const key = getItemKey(item);
    setError('');
    setEditingKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        label: item.label || '',
        pinned: supportsPin && item.pinned === true
      }
    }));
  };

  const handleAddGroup = () => {
    const editingGroup = pendingGroups.find((group) => group.isEditing);
    if (editingGroup) {
      setExpandedGroups((prev) => ({ ...prev, [getPendingGroupKey(editingGroup.id)]: true }));
      setSearchQuery('');
      setError('');
      window.requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPendingGroups((prev) => [{ id, name: '', isEditing: true }, ...prev]);
    setGroupSlots((prev) => [{
      slotId: getPendingGroupKey(id),
      name: '',
      pendingGroupId: id
    }, ...prev]);
    setExpandedGroups((prev) => ({ ...prev, [getPendingGroupKey(id)]: true }));
    setSearchQuery('');
    setError('');
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handlePendingGroupNameChange = (groupId, value) => {
    setPendingGroups((prev) => prev.map((group) => (
      group.id === groupId ? { ...group, name: value } : group
    )));
    setGroupSlots((prev) => prev.map((slot) => (
      slot.pendingGroupId === groupId ? { ...slot, name: value } : slot
    )));
  };

  const handleDeleteGroup = (group) => {
    if (group.visibleItems.length > 0) {
      return;
    }

    if (group.pendingGroupId) {
      setPendingGroups((prev) => prev.filter((entry) => entry.id !== group.pendingGroupId));
    }

    setGroupSlots((prev) => prev.filter((slot) => slot.slotId !== group.id));
    setExpandedGroups((prev) => {
      const next = { ...prev };
      delete next[group.id];
      return next;
    });
    setError('');
  };

  const handleSaveGroup = (groupId) => {
    const targetGroup = pendingGroups.find((group) => group.id === groupId);
    const groupName = normalizeText(targetGroup?.name || '');

    if (!groupName) {
      setError('Category group name is required.');
      return;
    }

    const normalizedGroupName = normalizeKey(groupName);
    const duplicateExists = groupedCatalog.some((group) => (
      group.pendingGroupId !== groupId && normalizeKey(group.name) === normalizedGroupName
    ));

    if (duplicateExists) {
      setError('A category group with this name already exists.');
      return;
    }

    setPendingGroups((prev) => prev.map((group) => (
      group.id === groupId ? { ...group, name: groupName, isEditing: false } : group
    )));
    setGroupSlots((prev) => prev.map((slot) => (
      slot.pendingGroupId === groupId ? { ...slot, name: groupName } : slot
    )));
    setExpandedGroups((prev) => ({
      ...prev,
      [getPendingGroupKey(groupId)]: true,
      [normalizedGroupName]: true
    }));
    setError('');
  };

  const handleAddItem = (group) => {
    const groupName = normalizeText(group.name || '');
    if (!groupName) {
      setError('Category group name is required before adding an item.');
      return;
    }

    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newItem = {
      tempId,
      label: '',
      group: groupName,
      category: groupName,
      sortOrder: -1,
      pinned: false,
      active: true
    };

    setPendingItems((prev) => [newItem, ...prev]);
    setSavedOrderKeys((prev) => [tempId, ...prev.filter((entry) => entry !== tempId)]);
    setEditingKeys((prev) => [tempId, ...prev]);
    setDrafts((prev) => ({
      ...prev,
      [tempId]: {
        label: '',
        pinned: false
      }
    }));
    setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
    setSearchQuery('');
    setError('');
  };

  const handleDraftChange = (key, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }));
  };

  const handleCancelEdit = (item) => {
    const key = getItemKey(item);
    setEditingKeys((prev) => prev.filter((entry) => entry !== key));
    resetDraftForKey(key);

    if (item.isNew) {
      setPendingItems((prev) => prev.filter((entry) => entry.tempId !== key));
      setSavedOrderKeys((prev) => prev.filter((entry) => entry !== key));
    }
    setError('');
  };

  const handleSave = async (item) => {
    const key = getItemKey(item);
    const draft = drafts[key] || {
      label: item.label || '',
      pinned: supportsPin && item.pinned === true
    };
    const label = normalizeText(draft.label);
    const pinned = supportsPin && draft.pinned === true;
    const group = getItemGroup(item);

    if (!label) {
      return setError('Item name is required.');
    }

    try {
      setSavingKey(key);
      setError('');

      const payload = {
        clinicId,
        type: itemType,
        label,
        group,
        pinned
      };

      const response = await fetch(
        item.isNew ? `${API_BASE_URL}/api/clinical-catalog` : `${API_BASE_URL}/api/clinical-catalog/${item._id}`,
        {
          method: item.isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setError(result.error || 'Failed to save library item.');
      }

      onCatalogUpdate(itemType, result);
      if (item.isNew) {
        const resultKey = getItemKey(result);
        setSavedOrderKeys((prev) => {
          const withoutResultKey = prev.filter((entry) => entry !== resultKey);
          if (!withoutResultKey.includes(key)) {
            return [resultKey, ...withoutResultKey];
          }
          return withoutResultKey.map((entry) => (entry === key ? resultKey : entry));
        });
      }
      setEditingKeys((prev) => prev.filter((entry) => entry !== key));
      resetDraftForKey(key);
      if (item.isNew) {
        setPendingItems((prev) => prev.filter((entry) => entry.tempId !== key));
        setPendingGroups((prev) => prev.filter((groupItem) => normalizeKey(groupItem.name) !== normalizeKey(group)));
      }
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setSavingKey('');
    }
  };

  const handleTogglePin = async (item) => {
    if (!supportsPin || item.isNew) return;
    const key = getItemKey(item);
    const nextPinned = !(item.pinned === true);

    try {
      setPinningKey(key);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/clinical-catalog/${item._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          label: item.label,
          group: getItemGroup(item),
          pinned: nextPinned
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setError(result.error || 'Failed to update pin status.');
      }

      onCatalogUpdate(itemType, result);
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setPinningKey('');
    }
  };

  const requestDeleteItem = (item) => {
    const key = getItemKey(item);

    if (item.isNew) {
      handleCancelEdit(item);
      return;
    }

    setConfirmDeleteItem(item);
    setError('');
  };

  const handleDelete = async () => {
    if (!confirmDeleteItem) {
      return;
    }

    const item = confirmDeleteItem;
    const key = getItemKey(item);

    try {
      setDeletingKey(key);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/clinical-catalog/${item._id}?clinicId=${clinicId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setError(result.error || 'Failed to remove library item.');
      }

      setSavedOrderKeys((prev) => prev.filter((entry) => entry !== key));
      onCatalogUpdate(itemType, result);
      setConfirmDeleteItem(null);
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setDeletingKey('');
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderGroupHeader = (group) => {
    const pendingGroup = group.pendingGroupId
      ? pendingGroups.find((entry) => entry.id === group.pendingGroupId)
      : null;
    const isEditingGroup = Boolean(pendingGroup?.isEditing);
    const isExpanded = isSearchMode ? true : Boolean(expandedGroups[group.id]);
    const Count = group.visibleItems.length;

    if (isEditingGroup) {
      return (
        <div className="w-full flex items-center gap-1.5 px-3 py-2.5 bg-white border-b border-slate-100">
          <input
            type="text"
            value={pendingGroup?.name || ''}
            onChange={(event) => handlePendingGroupNameChange(pendingGroup.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSaveGroup(pendingGroup.id);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                handleDeleteGroup(group);
              }
            }}
            placeholder="Add category group name"
            autoFocus
            className={`flex-1 min-w-0 ${inlineInputClass} !h-[30px] pl-2 pr-2 border-teal-300 bg-white text-slate-800 focus:ring-1 focus:ring-teal-500`}
          />
          <button
            type="button"
            onClick={() => handleSaveGroup(pendingGroup.id)}
            className={`${actionButtonClass} text-teal-700 hover:bg-teal-50`}
            aria-label="Save category group"
            title="Save"
          >
            <Save size={12} />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteGroup(group)}
            className={`${actionButtonClass} text-slate-500 hover:bg-slate-100`}
            aria-label="Cancel category group"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          if (!isSearchMode) {
            toggleGroup(group.id);
          }
        }}
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-white ${isSearchMode ? 'cursor-default' : 'hover:bg-slate-50'} transition-colors border-b border-slate-100`}
      >
        <div className="min-w-0 text-left">
          <p className="type-section-title text-slate-800 truncate">{group.name || 'New Category Group'}</p>
          <p className="type-label text-slate-400">{Count} item{Count === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2 pl-2">
          {isSearchMode && <span className="type-label text-red-500">Filtered</span>}
          {isExpanded ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
        </div>
      </button>
    );
  };

  const renderGroupBody = (group) => {
    const pendingGroup = group.pendingGroupId
      ? pendingGroups.find((entry) => entry.id === group.pendingGroupId)
      : null;

    if (pendingGroup?.isEditing) {
      return null;
    }

    const canDeleteGroup = group.visibleItems.length === 0;

    return (
      <div className="p-2 space-y-2 bg-slate-50/60">
        <div className={`grid gap-2 ${canDeleteGroup ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={() => handleAddItem(group)}
            className="type-label w-full py-2 rounded-lg border border-dashed border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Add Item
          </button>

          {canDeleteGroup && (
            <button
              type="button"
              onClick={() => handleDeleteGroup(group)}
              className="type-label w-full py-2 rounded-lg border border-dashed border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Trash2 size={14} /> Delete This Group
            </button>
          )}
        </div>

        {group.visibleItems.length > 0 ? group.visibleItems.map((item) => {
          const key = getItemKey(item);
          const isEditing = editingKeys.includes(key);
          const isSaving = savingKey === key;
          const isPinning = pinningKey === key;
          const isDeleting = deletingKey === key;
          const draft = drafts[key] || {
            label: item.label || '',
            pinned: supportsPin && item.pinned === true
          };
          const showSecondaryAction = supportsPin || isEditing;
          return (
            <div key={key} className="min-h-[42px] py-1 px-0 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-1.5 ml-2 mr-1">
                <input
                  type="text"
                  value={isEditing ? draft.label : item.label || ''}
                  onChange={(event) => handleDraftChange(key, 'label', event.target.value)}
                  disabled={!isEditing || isSaving}
                  className={`flex-1 min-w-0 ${inlineInputClass} ${
                    isEditing
                      ? '!h-[30px] pl-1 pr-1 border-teal-300 bg-white text-slate-800 focus:ring-1 focus:ring-teal-500'
                      : '!h-[30px] pl-1 pr-1 border-transparent bg-slate-50 text-slate-800'
                  }`}
                  placeholder="Item name"
                />

                {showSecondaryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        handleCancelEdit(item);
                        return;
                      }
                      handleTogglePin(item);
                    }}
                    disabled={isSaving || isPinning || isDeleting}
                    aria-label={isEditing ? 'Cancel editing' : item.pinned === true ? 'Pinned item' : 'Pin item'}
                    title={isEditing ? 'Cancel' : item.pinned === true ? 'Pinned' : 'Pin'}
                    className={`${actionButtonClass} ${
                      isEditing
                        ? 'text-slate-500 hover:bg-slate-100'
                        : item.pinned === true
                          ? 'text-amber-700 hover:bg-amber-50'
                          : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {isPinning ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isEditing ? (
                      <X size={12} />
                    ) : (
                      <Pin size={12} className={item.pinned === true ? 'fill-current' : ''} />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (isEditing ? handleSave(item) : openInlineEditor(item))}
                  disabled={isSaving || isPinning || isDeleting}
                  aria-label={isEditing ? 'Save item' : 'Edit item'}
                  title={isEditing ? 'Save' : 'Edit'}
                  className={`${actionButtonClass} ${
                    isEditing
                      ? 'text-teal-700 hover:bg-teal-50'
                      : 'text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : isEditing ? <Save size={12} /> : <Edit2 size={12} />}
                </button>

                <button
                  type="button"
                  onClick={() => requestDeleteItem(item)}
                  disabled={isSaving || isPinning || isDeleting}
                  className={`${actionButtonClass} text-orange-400 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed`}
                  aria-label={`Remove ${item.label || 'item'}`}
                  title="Delete"
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="type-secondary p-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
            No items in this category group yet.
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setEditingKeys([]);
        setDrafts({});
        setPendingItems([]);
        setPendingGroups([]);
        setGroupSlots([]);
        setExpandedGroups({});
        setError('');
        setSavingKey('');
        setPinningKey('');
        setDeletingKey('');
        setConfirmDeleteItem(null);
        onClose();
      }}
      title={`${title} (${items.length})`}
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[min(720px,calc(var(--app-height)-1.5rem))] animate-scaleIn"
      bodyClassName="px-2 pt-2 pb-2 overflow-hidden flex-1 min-h-0"
      footer={
        <button
          type="button"
          onClick={handleAddGroup}
          className={`type-section-title w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            hasEditingGroup
              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              : 'bg-teal-600 text-white hover:bg-teal-700'
          }`}
        >
          {hasEditingGroup ? (
            <>
              <Save size={16} /> Save Current Category First
            </>
          ) : (
            <>
              <Plus size={16} /> Add Category Group
            </>
          )}
        </button>
      }
    >
      <div className="h-full min-h-0 flex flex-col space-y-2">
        <AlertMessage message={error} />

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search categories or items..."
            className="type-body w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div ref={listRef} className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-hide">
          {filteredGroups.length > 0 ? filteredGroups.map((group) => {
            const isExpanded = isSearchMode ? true : Boolean(expandedGroups[group.id]);

            return (
              <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {renderGroupHeader(group)}
                {isExpanded && renderGroupBody(group)}
              </div>
            );
          }) : (
            <div className="type-secondary p-6 text-center text-slate-400 font-medium">
              No library items found.
            </div>
          )}
        </div>

        {confirmDeleteItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-orange-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="type-section-title text-slate-800">
                      Remove "{confirmDeleteItem.label}" from {title}?
                    </h4>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteItem(null)}
                  disabled={Boolean(deletingKey)}
                  className="type-label px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={Boolean(deletingKey)}
                  className="type-label px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-70 inline-flex items-center justify-center gap-2 min-w-[86px]"
                >
                  {deletingKey ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Removing
                    </>
                  ) : (
                    'Remove'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ClinicalLibraryModal;
