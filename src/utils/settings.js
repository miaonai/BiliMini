export const SETTINGS_KEY = 'popupSettings';

export const TAB_OPTIONS = Object.freeze([
  { id: '1', label: '投稿' },
  { id: '2', label: '番剧', setting: 'showBangumi' },
  { id: '3', label: '直播', setting: 'showLive' },
  { id: '4', label: '历史', setting: 'showHistory' },
  { id: '5', label: '热门', setting: 'showPopular' },
]);

export const DEFAULT_SETTINGS = Object.freeze({
  tabOrder: Object.freeze(TAB_OPTIONS.map(tab => tab.id)),
  showBangumi: true,
  showLive: true,
  showHistory: true,
  showPopular: true,
  showVideoBadge: true,
  showLiveBadge: true,
  hideChargeOnly: false,
  showWatchLater: true,
  hideScrollbar: false,
  popupWidth: 560,
  columns: 'auto',
});

export function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(settings)) {
    if (typeof settings[key] === 'boolean' && typeof source[key] === 'boolean') {
      settings[key] = source[key];
    }
  }
  for (const [key, min, max] of [['popupWidth', 380, 800]]) {
    if (typeof source[key] === 'number' && Number.isFinite(source[key])) {
      settings[key] = Math.max(min, Math.min(max, Math.round(source[key])));
    }
  }
  if (['auto', 1, 2, 3, 4].includes(source.columns)) settings.columns = source.columns;
  const savedOrder = Array.isArray(source.tabOrder) ? source.tabOrder : [];
  // Keep valid saved positions, remove duplicates and append missing/new tabs.
  settings.tabOrder = [...new Set([...savedOrder, ...DEFAULT_SETTINGS.tabOrder])]
    .filter(id => DEFAULT_SETTINGS.tabOrder.includes(id));
  return settings;
}

export function columnCount(settings) {
  return settings.columns === 'auto'
    ? (settings.popupWidth >= 760 ? 4 : settings.popupWidth >= 580 ? 3 : 2)
    : settings.columns;
}

export function orderedTabs(settings) {
  return (settings.tabOrder || DEFAULT_SETTINGS.tabOrder).map(id => TAB_OPTIONS.find(tab => tab.id === id));
}

export function visibleTabs(settings) {
  return orderedTabs(settings).filter(tab => !tab.setting || settings[tab.setting]).map(tab => tab.id);
}

export function applyPopupSize(settings) {
  const style = document.documentElement.style;
  style.setProperty('--popup-width', `${settings.popupWidth}px`);
  const columns = columnCount(settings);
  const cardWidth = (settings.popupWidth - 24 - 12 * (columns - 1)) / columns;
  style.setProperty('--card-columns', `repeat(${columns}, minmax(0, 1fr))`);
  style.setProperty('--card-font-size', `${Math.max(13, Math.min(17, 13 + (cardWidth - 170) / 50))}px`);
}
