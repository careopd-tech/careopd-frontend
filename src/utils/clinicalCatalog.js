const EMPTY_CATALOG = {
  complaints: [],
  drugs: [],
  labTests: [],
  meta: { total: 0, syncedAt: '', version: '' }
};

const getCatalogCacheKey = (clinicId) => `careopd_clinical_catalog_${clinicId}`;

export const getEmptyClinicalCatalog = () => ({
  complaints: [],
  drugs: [],
  labTests: [],
  meta: { total: 0, syncedAt: '', version: '' }
});

export const getCachedClinicalCatalog = (clinicId) => {
  if (!clinicId) return getEmptyClinicalCatalog();

  try {
    const parsed = JSON.parse(localStorage.getItem(getCatalogCacheKey(clinicId)) || 'null');
    if (!parsed || typeof parsed !== 'object') return getEmptyClinicalCatalog();
    return {
      complaints: Array.isArray(parsed.complaints) ? parsed.complaints : [],
      drugs: Array.isArray(parsed.drugs) ? parsed.drugs : [],
      labTests: Array.isArray(parsed.labTests) ? parsed.labTests : [],
      meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : EMPTY_CATALOG.meta
    };
  } catch (err) {
    return getEmptyClinicalCatalog();
  }
};

export const cacheClinicalCatalog = (clinicId, catalog) => {
  if (!clinicId) return;
  localStorage.setItem(getCatalogCacheKey(clinicId), JSON.stringify(catalog || getEmptyClinicalCatalog()));
};

export const isActiveCatalogItem = (item) => item?.active !== false;
export const isPinnedCatalogItem = (item) => item?.pinned === true;

export const groupCatalogByCategory = (items = []) => {
  const groupedMap = new Map();

  items
    .filter(isActiveCatalogItem)
    .forEach((item) => {
      const category = item.category || 'General';
      if (!groupedMap.has(category)) {
        groupedMap.set(category, []);
      }
      groupedMap.get(category).push(item);
    });

  return Array.from(groupedMap.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems.sort((a, b) => {
      if ((a.sortOrder ?? 9999) !== (b.sortOrder ?? 9999)) {
        return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
      }
      return String(a.label || '').localeCompare(String(b.label || ''));
    })
  }));
};

export const getQuickCatalogItems = (items = [], limit = 9) => (
  items
    .filter(isActiveCatalogItem)
    .slice()
    .sort((a, b) => {
      if (isPinnedCatalogItem(a) !== isPinnedCatalogItem(b)) {
        return isPinnedCatalogItem(a) ? -1 : 1;
      }
      if ((a.sortOrder ?? 9999) !== (b.sortOrder ?? 9999)) {
        return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
      }
      return String(a.label || '').localeCompare(String(b.label || ''));
    })
    .slice(0, limit)
);
