import { formatCount } from './feed.js';
import { formatDuration } from './history.js';

export function appendPopularPage(state, data, toWatchAids = []) {
  if (!Array.isArray(data.list)) throw new Error('Invalid popular response');
  const seen = new Set(state.cards.map(card => card.index));
  const previousCount = state.cards.length;
  for (const item of data.list) {
    if (!item?.aid) continue;
    const index = `popular-${item.aid}`;
    if (seen.has(index)) continue;
    state.cards.push({
      index, type_: 'video', aid: item.aid,
      media_link: `https://www.bilibili.com/video/${item.bvid || `av${item.aid}`}/`,
      media_title: item.title,
      media_cover: item.pic?.replace(/^http:/, 'https:'),
      media_duration: formatDuration(item.duration),
      play: formatCount(item.stat?.view),
      danmaku: formatCount(item.stat?.danmaku),
      toWatch: toWatchAids.includes(Number(item.aid)),
      show_text: item.rcmd_reason?.content || '',
      up_link: item.owner?.mid ? `https://space.bilibili.com/${item.owner.mid}/` : '',
      up_title: item.owner?.name || '',
      up_cover: item.owner?.face?.replace(/^http:/, 'https:'),
    });
    seen.add(index);
  }
  // A short page may have a successor; use the API flag. Stop repeated or
  // empty pages too, so an unchanged response cannot keep loading forever.
  state.noMore = Boolean(data.no_more) || state.cards.length === previousCount;
  state.page += 1;
}
