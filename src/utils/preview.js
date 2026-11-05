// Bilibili-Gate uses the same videoshot sheets, with the first cell reserved:
// https://github.com/magicdawn/Bilibili-Gate/blob/7edc62a55b19032f5225e89a3955d487ec31df33/src/components/VideoCard/child-components/PreviewImage.tsx
const positiveId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

export function normalizePreviewTarget(value) {
  if (!value || typeof value !== 'object') return null;
  const target = {};
  if (positiveId(value.aid)) target.aid = String(value.aid);
  else if (/^BV[\da-z]{10}$/i.test(value.bvid || '')) target.bvid = value.bvid;
  else if (positiveId(value.epid)) target.epid = String(value.epid);
  else return null;
  if (positiveId(value.cid)) target.cid = String(value.cid);
  if (positiveId(value.page)) target.page = Number(value.page);
  target.duration = value.duration;
  return target;
}

export function previewTargetKey(value) {
  const target = normalizePreviewTarget(value);
  if (!target) return '';
  return `${target.aid ? 'av' + target.aid : target.bvid || 'ep' + target.epid}:${target.cid || ''}:${target.page || 1}`;
}

function durationSeconds(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value !== 'string' || !/^\d+:\d{2}(:\d{2})?$/.test(value)) return 0;
  return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

export function normalizePreviewData(data, duration) {
  if (!data || !Array.isArray(data.image) || !data.image.length || !Array.isArray(data.index) || !data.index.length) return null;
  const columns = data.img_x_len;
  const rows = data.img_y_len;
  if (![columns, rows, data.img_x_size, data.img_y_size].every(value => Number.isInteger(value) && value > 0 && value <= 4096)) return null;
  if (columns > 100 || rows > 100 || data.image.length > 1000) return null;
  const images = [];
  for (const value of data.image) {
    if (typeof value !== 'string' || !/^(https?:)?\/\//.test(value)) return null;
    try {
      const url = new URL(value, 'https://www.bilibili.com');
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      url.protocol = 'https:';
      images.push(url.href);
    } catch (error) { return null; }
  }
  const capacity = columns * rows * images.length;
  const offset = capacity > 1 ? 1 : 0;
  const times = data.index.slice(0, capacity - offset);
  if (!times.length || times.some((time, index) => typeof time !== 'number' || !Number.isFinite(time) || time < 0 || (index && time < times[index - 1]))) return null;
  return { images, columns, rows, times, offset, duration: durationSeconds(duration) || times[times.length - 1] || 1 };
}

export function previewFrame(data, progress) {
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const time = fraction * data.duration;
  let left = 0;
  let right = data.times.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (data.times[middle] <= time) left = middle + 1;
    else right = middle;
  }
  const index = Math.max(0, left - 1) + data.offset;
  const cellCount = data.columns * data.rows;
  const cell = index % cellCount;
  const column = cell % data.columns;
  const row = Math.floor(cell / data.columns);
  return {
    url: data.images[Math.floor(index / cellCount)],
    index, time, progress: fraction,
    style: {
      backgroundImage: `url(${JSON.stringify(data.images[Math.floor(index / cellCount)])})`,
      backgroundSize: `${data.columns * 100}% ${data.rows * 100}%`,
      backgroundPosition: `${data.columns > 1 ? column * 100 / (data.columns - 1) : 0}% ${data.rows > 1 ? row * 100 / (data.rows - 1) : 0}%`,
    },
  };
}

export function createPreviewLoader(fetchData) {
  const cache = new Map();
  const pending = new Map();
  return async value => {
    const target = normalizePreviewTarget(value);
    const key = previewTargetKey(target);
    if (!key) return null;
    if (cache.has(key)) {
      const data = cache.get(key);
      cache.delete(key);
      cache.set(key, data);
      return data;
    }
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      // The endpoint sometimes returns sheets before the timestamp index is ready.
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetchData(target);
        if (response?.code !== 0) throw new Error('Preview request failed');
        const data = normalizePreviewData(response.data, 'duration' in response ? response.duration : target.duration);
        if (data) {
          cache.set(key, data);
          if (cache.size > 100) cache.delete(cache.keys().next().value);
          return data;
        }
        if (!response.data?.image?.length) return null;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200));
      }
      return null;
    })();
    pending.set(key, request);
    try { return await request; }
    finally { pending.delete(key); }
  };
}
