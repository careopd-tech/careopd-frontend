import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit2, Pin, Plus, Save, Search } from 'lucide-react';
import Modal from '../ui/Modal';
import AlertMessage from '../ui/AlertMessage';
import API_BASE_URL from '../../config';

const ClinicalLibraryModal = ({
  clinicId,
  isOpen,
  onClose,
  title,
  itemType,
  items = [],
  onCatalogUpdate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKeys, setEditingKeys] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [pendingItems, setPendingItems] = useState([]);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [pinningKey, setPinningKey] = useState('');
  const [savedOrderKeys, setSavedOrderKeys] = useState([]);
  const listRef = useRef(null);
  const actionButtonClass = 'min-w-[88px] h-7 px-2 rounded-lg text-[11px] font-bold transition-colors border inline-flex items-center justify-center gap-1 whitespace-nowrap';
  const compactInputClass = 'h-7 px-2 py-1 rounded-lg outline-none border';

  const getItemKey = (item) => String(
    item.tempId ||
    item._id ||
    item.seedKey ||
    item.normalizedLabel ||
    `${itemType}-${item.label || ''}-${item.description || ''}`
  );
  const isItemPinned = (item) => item?.pinned === true;
  const sortItemsByLabel = (catalogItems = []) => catalogItems
    .slice()
    .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }));
  const getInitialOrderedItems = (catalogItems = []) => sortItemsByLabel(catalogItems);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setEditingKeys([]);
    setDrafts({});
    setPendingItems([]);
    setError('');
    setSavingKey('');
    setPinningKey('');
    setSavedOrderKeys(getInitialOrderedItems(items).map(getItemKey));
  }, [isOpen, itemType]);

  useEffect(() => {
    if (!isOpen) return;

    setSavedOrderKeys((prev) => {
      const currentKeys = new Set(items.map(getItemKey));
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
  }, [items, isOpen, itemType]);

  const displayItems = useMemo(() => {
    const pendingDisplayItems = pendingItems.map((item) => ({
      ...item,
      isNew: true
    }));

    const itemMap = new Map(items.map((item) => [getItemKey(item), item]));
    const orderedKeys = savedOrderKeys.length > 0
      ? savedOrderKeys
      : getInitialOrderedItems(items).map(getItemKey);
    const orderedKeySet = new Set(orderedKeys);
    const orderedSavedItems = [
      ...orderedKeys.map((key) => itemMap.get(key)).filter(Boolean),
      ...items.filter((item) => !orderedKeySet.has(getItemKey(item)))
    ];
    const savedDisplayItems = orderedSavedItems.map((item) => ({
      ...item,
      isNew: false
    }));

    return [...pendingDisplayItems, ...savedDisplayItems];
  }, [items, pendingItems, savedOrderKeys]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return displayItems
      .filter((item) => {
        if (!normalizedSearch) return true;
        return [
          item.label,
          item.description,
          item.category
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      });
  }, [displayItems, searchQuery]);

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
    setEditingKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        label: item.label || '',
        description: item.description || '',
        category: item.category || 'General',
        pinned: item.pinned === true
      }
    }));
  };

  const handleAddItem = () => {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newItem = {
      tempId,
      label: '',
      description: '',
      category: 'General',
      sortOrder: -1,
      pinned: false,
      active: true
    };

    setPendingItems((prev) => [newItem, ...prev]);
    setEditingKeys((prev) => [tempId, ...prev]);
    setDrafts((prev) => ({
      ...prev,
      [tempId]: {
        label: '',
        description: '',
        category: 'General',
        pinned: false
      }
    }));
    setSearchQuery('');
    setError('');
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
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
    }
    setError('');
  };

  const handleSave = async (item) => {
    const key = getItemKey(item);
    const draft = drafts[key] || {
      label: item.label || '',
      description: item.description || '',
      category: item.category || 'General',
      pinned: item.pinned === true
    };
    const label = String(draft.label || '').trim();
    const description = String(draft.description || '').trim();
    const category = String(draft.category || '').trim() || 'General';
    const pinned = draft.pinned === true;

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
        description,
        category,
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
        setSavedOrderKeys((prev) => [resultKey, ...prev.filter((entry) => entry !== resultKey)]);
      }
      setEditingKeys((prev) => prev.filter((entry) => entry !== key));
      resetDraftForKey(key);
      if (item.isNew) {
        setPendingItems((prev) => prev.filter((entry) => entry.tempId !== key));
      }
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setSavingKey('');
    }
  };

  const handleTogglePin = async (item) => {
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
          description: item.description || '',
          category: item.category || 'General',
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setEditingKeys([]);
        setDrafts({});
        setPendingItems([]);
        setError('');
        setSavingKey('');
        setPinningKey('');
        onClose();
      }}
      title={`${title} (${items.length})`}
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col h-[min(640px,calc(var(--app-height)-1.5rem))] animate-scaleIn"
      bodyClassName="px-4 pt-4 pb-2 overflow-hidden flex-1 min-h-0"
      footer={
        <button
          type="button"
          onClick={handleAddItem}
          className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add Item
        </button>
      }
    >
      <div className="h-full min-h-0 flex flex-col space-y-3">
        <AlertMessage message={error} />

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div ref={listRef} className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-hide">
          {filteredItems.length > 0 ? filteredItems.map((item) => {
            const key = getItemKey(item);
            const isEditing = editingKeys.includes(key);
            const isSaving = savingKey === key;
            const isPinning = pinningKey === key;
            const draft = drafts[key] || {
              label: item.label || '',
              description: item.description || '',
              category: item.category || 'General',
              pinned: item.pinned === true
            };
            const rowPinned = isEditing ? draft.pinned === true : isItemPinned(item);

            return (
              <div key={key} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                  <input
                    type="text"
                    value={isEditing ? draft.label : item.label || ''}
                    onChange={(event) => handleDraftChange(key, 'label', event.target.value)}
                    disabled={!isEditing || isSaving}
                    className={`w-full ${compactInputClass} text-[13px] ${isEditing ? 'border-teal-300 bg-white focus:ring-1 focus:ring-teal-500' : 'border-transparent bg-slate-50 text-slate-800'}`}
                    placeholder="Item"
                  />

                  <button
                    type="button"
                    onClick={() => (isEditing ? handleSave(item) : openInlineEditor(item))}
                    disabled={isSaving || isPinning}
                    className={`${actionButtonClass} ${
                      isEditing
                        ? 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isEditing ? <Save size={12} /> : <Edit2 size={12} />}
                      {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                  <input
                    type="text"
                    value={isEditing ? draft.description : item.description || ''}
                    onChange={(event) => handleDraftChange(key, 'description', event.target.value)}
                    disabled={!isEditing || isSaving}
                    className={`w-full ${compactInputClass} text-[12px] ${isEditing ? 'border-teal-300 bg-white focus:ring-1 focus:ring-teal-500' : 'border-transparent bg-slate-50 text-slate-600'}`}
                    placeholder="Description"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        handleDraftChange(key, 'pinned', !(draft.pinned === true));
                        return;
                      }
                      if (!item.isNew) {
                        handleTogglePin(item);
                      }
                    }}
                    disabled={isSaving || isPinning}
                    className={`${actionButtonClass} ${
                      rowPinned
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    } ${isPinning ? 'opacity-70' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1"><Pin size={12} /> {rowPinned ? 'Pinned' : 'Pin'}</span>
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-6 text-center text-[12px] text-slate-400 font-medium">
              No library items found.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ClinicalLibraryModal;
