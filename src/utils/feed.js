export function createFeedState() {
  return { cards: [], foldInfo: {}, extraAuthors: {}, offset: '', page: 1,
    noMore: false, loaded: false, loading: false, error: '' };
}

export function formatCount(value) {
  if (value === undefined || value === null || value === '') return '';
  // Dynamic feeds already format large counts (for example, "1.2万").
  if (typeof value === 'string' && !/^\d+$/.test(value)) return value;
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return '';
  if (count >= 100000000) return `${Number((count / 100000000).toFixed(1))}亿`;
  if (count >= 10000) return `${Number((count / 10000).toFixed(1))}万`;
  return String(count);
}

export function visibleCards(cards, hideChargeOnly) {
  return hideChargeOnly ? cards.filter(card => !card.isChargeOnly) : cards;
}

// Keep the server cursor independently of visible cards, including filtered pages.
export function appendDynamicPage(state, data, toWatchAids = []) {
  const items = Array.isArray(data.items) ? data.items : [];
  const offset = data.offset || items[items.length - 1]?.id_str || '';
  state.noMore = !data.has_more || !offset || offset === state.offset;
  state.offset = offset;
  const knownIds = new Set(state.cards.map(card => card.dynamicId));
  for (const item of items) {
    if (!item.id_str || knownIds.has(item.id_str)) continue;
    const major = item.modules?.module_dynamic?.major;
    const info = item.type === 'DYNAMIC_TYPE_AV' ? major?.archive :
      item.type === 'DYNAMIC_TYPE_PGC_UNION' ? major?.pgc : null;
    const author = item.modules?.module_author;
    if (!info || !author) continue;
    const video = item.type === 'DYNAMIC_TYPE_AV';
    const authorCard = { up_link: author.jump_url, up_title: author.name, up_cover: author.face };
    const originId = state.foldInfo[item.id_str];
    if (video && originId) {
      const authors = state.extraAuthors[originId] || [];
      if (!authors.some(existing => existing.up_link === authorCard.up_link)) authors.push(authorCard);
      state.extraAuthors = { ...state.extraAuthors, [originId]: authors };
      continue;
    }
    if (video) {
      for (const id of item.modules.module_fold?.ids || []) state.foldInfo[id] = item.id_str;
    }
    state.cards.push({
      dynamicId: item.id_str,
      index: item.id_str,
      type_: video ? 'video' : 'pgc',
      aid: video ? info.aid : info.epid,
      media_link: info.jump_url,
      media_title: info.title,
      media_cover: info.cover,
      media_duration: info.duration_text || '',
      play: formatCount(info.stat?.play),
      danmaku: formatCount(info.stat?.danmaku),
      isChargeOnly: video && info.badge?.text === '充电专属',
      toWatch: video && toWatchAids.includes(Number(info.aid)),
      show_text: author.pub_time,
      ...authorCard,
    });
    knownIds.add(item.id_str);
  }
}

export function appendLivePage(state, data) {
  const list = Array.isArray(data.list) ? data.list : [];
  state.noMore = list.length < 10;
  const knownIds = new Set(state.cards.map(card => card.index));
  for (const item of list) {
    const index = `live-${item.roomid || item.uid}`;
    if (knownIds.has(index)) continue;
    state.cards.push({ index, type_: 'live', media_link: item.link,
      media_title: item.title, media_cover: item.pic, show_text: item.watched_show?.text_large,
      up_link: `https://space.bilibili.com/${item.uid}/`, up_title: item.uname, up_cover: item.face });
    knownIds.add(index);
  }
  state.page += 1;
}
