// Device codes follow Bilibili's history page, also documented in Gate:
// https://github.com/magicdawn/Bilibili-Gate/blob/main/src/modules/rec-services/history/enums.tsx
export function watchDevice(dt) {
  const type = { 1: 'phone', 2: 'computer', 3: 'phone', 4: 'tablet', 5: 'phone',
    6: 'tablet', 7: 'phone', 8: 'car', 9: 'speaker', 10: 'tablet', 11: 'tv',
    12: 'phone', 13: 'tablet', 14: 'computer', 33: 'tv' }[dt] || 'unknown';
  const label = { phone: '手机端观看', computer: '电脑端观看', tablet: '平板端观看',
    car: '车载端观看', speaker: '智能音箱端观看', tv: '电视端观看', unknown: '未知观看平台' }[type];
  return { type, label };
}

export function createHistoryState() {
  return { cards: [], cursor: null, loading: false, loaded: false, noMore: false, error: '' };
}

export function appendHistoryPage(state, data, formatViewedAt) {
  const seen = new Set(state.cards.map(card => card.index));
  for (const item of data.list) {
    const card = historyCard(item, item.view_at ? formatViewedAt(item.view_at) : '');
    if (!card || seen.has(card.index)) continue;
    seen.add(card.index);
    state.cards.push(card);
  }
  const cursor = data.cursor;
  const sameCursor = state.cursor && cursor && ['max', 'view_at', 'business']
    .every(key => String(state.cursor[key] ?? '') === String(cursor[key] ?? ''));
  // A short page can still have a successor. Stop on an empty page or a
  // missing/non-advancing cursor, so a repeated response cannot loop forever.
  state.noMore = !data.list.length || !cursor || (!Number(cursor.max) && !Number(cursor.view_at)) || Boolean(sameCursor);
  state.cursor = cursor ? { max: cursor.max, view_at: cursor.view_at, business: cursor.business } : null;
  state.loaded = true;
}

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '';
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value / 60) % 60;
  const remainder = String(value % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}`
    : `${String(minutes).padStart(2, '0')}:${remainder}`;
}

export function watchProgress(progress, duration) {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) {
    return { percent: null, text: '进度未知', label: '观看进度未知' };
  }
  const hasDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
  if (progress < 0 || (hasDuration && progress >= duration)) {
    return { percent: 100, text: '已看完', label: '已看完' };
  }
  const text = `已看 ${formatDuration(progress)}`;
  return {
    percent: hasDuration ? Math.min(100, Math.max(0, Math.round(progress / duration * 100))) : null,
    text,
    label: hasDuration ? `${text} / ${formatDuration(duration)}` : text,
  };
}

export function historyCard(item, viewedAt) {
  const history = item.history || {};
  const target = item.uri || (history.bvid ? `https://www.bilibili.com/video/${history.bvid}/` : '');
  if (!target) return null;
  let link;
  try {
    link = new URL(target, 'https://www.bilibili.com');
    if (!['http:', 'https:'].includes(link.protocol)) return null;
    link.protocol = 'https:';
    if (history.page > 1) link.searchParams.set('p', String(history.page));
  } catch (error) { return null; }
  return {
    index: `${history.business || 'archive'}-${item.kid || history.bvid || history.oid}-${item.view_at}`,
    type_: 'history',
    media_link: link.href,
    media_title: item.title,
    media_cover: item.cover,
    media_duration: item.duration > 0 ? formatDuration(item.duration) : '',
    play: '',
    danmaku: '',
    up_link: item.author_mid ? `https://space.bilibili.com/${item.author_mid}/` : '',
    up_title: item.author_name || item.show_title || '',
    up_cover: item.author_face || '',
    viewed_at: viewedAt,
    watch_device: watchDevice(history.dt),
    // Gate computes watched progress for archive history. Other business types
    // retain their destination and duration without inferring completion.
    watch_progress: history.business === 'archive' ? watchProgress(item.progress, item.duration) : null,
  };
}
