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
    // Gate computes watched progress for archive history. Other business types
    // retain their destination and duration without inferring completion.
    watch_progress: history.business === 'archive' ? watchProgress(item.progress, item.duration) : null,
  };
}
