export const normalizeMacSearch = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^0-9a-f]/g, '')
    .slice(0, 12);

export const formatResidentMac = (value) => {
  const normalized = normalizeMacSearch(value);
  if (!normalized) return '';

  return normalized.match(/.{1,4}/g)?.join('-') || '';
};
