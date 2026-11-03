export const SETTINGS_KEY = 'popupSettings';

export const DEFAULT_SETTINGS = Object.freeze({
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
  return settings;
}

export function columnCount(settings) {
  return settings.columns === 'auto'
    ? (settings.popupWidth >= 760 ? 4 : settings.popupWidth >= 580 ? 3 : 2)
    : settings.columns;
}

export function visibleTabs(settings) {
  return ['1', ...(settings.showBangumi ? ['2'] : []),
    ...(settings.showLive ? ['3'] : []), ...(settings.showHistory ? ['4'] : []),
    ...(settings.showPopular ? ['5'] : [])];
}

export function applyPopupSize(settings) {
  const style = document.documentElement.style;
  style.setProperty('--popup-width', `${settings.popupWidth}px`);
  const columns = columnCount(settings);
  const cardWidth = (settings.popupWidth - 24 - 12 * (columns - 1)) / columns;
  style.setProperty('--card-columns', `repeat(${columns}, minmax(0, 1fr))`);
  style.setProperty('--card-font-size', `${Math.max(13, Math.min(17, 13 + (cardWidth - 170) / 50))}px`);
}
