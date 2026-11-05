<template>
  <article class="card" :class="{ 'hover-glow': hoverGlow, 'hover-zoom': hoverZoom, previewing: isPreviewing }"
    @mouseenter="movePreview" @mousemove="movePreview" @mouseleave="previewHovered = false">
    <div class="cover-wrap">
      <a class="video-img" :href="cardObj.media_link" :aria-label="cardObj.media_title" @click.prevent="handleLink(cardObj.media_link)">
        <div class="cover-frame">
          <img class="cover" :src="cardObj.media_cover" alt="" />
          <cover-preview v-if="previewEnabled && previewSettings && previewSettings.hoverPreview && cardObj.preview"
            :target="cardObj.preview" :settings="previewSettings" :active="previewHovered" :position="previewPosition"
            @visibility-change="previewVisible = $event" />
        </div>
        <div v-if="cardObj.type_ !== 'live'" class="video-stats">
          <span v-if="cardObj.watch_progress" class="watched-text">{{ cardObj.watch_progress.text }}</span>
          <div v-else class="counts">
            <span v-if="cardObj.play" class="stat" :title="'播放量 ' + cardObj.play" :aria-label="'播放量 ' + cardObj.play">
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3.5" width="16" height="13" rx="3" /><path d="m8 7 5 3-5 3z" /></svg>{{ cardObj.play }}
            </span>
            <span v-if="cardObj.danmaku" class="stat" :title="'弹幕数 ' + cardObj.danmaku" :aria-label="'弹幕数 ' + cardObj.danmaku">
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3.5" width="16" height="13" rx="3" /><path d="M5 7h4m3 0h3M5 10h2m3 0h5M5 13h6" /></svg>{{ cardObj.danmaku }}
            </span>
          </div>
          <span v-if="cardObj.media_duration" class="duration" :aria-label="'时长 ' + cardObj.media_duration">{{ cardObj.media_duration }}</span>
        </div>
      </a>
      <div v-if="cardObj.watch_progress && cardObj.watch_progress.percent !== null" class="watch-progress"
        role="progressbar" aria-label="观看进度" aria-valuemin="0" aria-valuemax="100"
        :aria-valuenow="cardObj.watch_progress.percent" :aria-valuetext="cardObj.watch_progress.label">
        <span :style="{ width: cardObj.watch_progress.percent + '%' }" />
      </div>
      <span v-if="cardObj.show_text" class="show-text">{{ cardObj.show_text }}</span>
      <button v-if="showWatchLater && cardObj.type_ === 'video'" type="button" class="watch-later"
        :class="{ added: addedToWatch }" :disabled="watchPending" :aria-pressed="String(addedToWatch)"
        :title="addedToWatch ? '取消稍后再看' : '添加稍后再看'" :aria-label="addedToWatch ? '取消稍后再看' : '添加稍后再看'"
        @click="handleWatchLater">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path v-if="addedToWatch" d="m6 12 4 4 8-9" />
          <g v-else><circle cx="12" cy="12" r="8.5" /><path d="M12 6.5V12l3.5 2" /></g>
        </svg>
      </button>
    </div>
    <div class="container">
      <a class="title-link" :href="cardObj.media_link" :title="cardObj.media_title" @click.prevent="handleLink(cardObj.media_link)">
        <h3 class="title">{{ cardObj.media_title }}</h3>
      </a>
      <component :is="cardObj.up_link ? 'a' : 'div'" class="up-link" :href="cardObj.up_link" :title="extraAuthors && extraAuthors.length ? '联合投稿' : cardObj.up_title" @click.prevent="handleLink(cardObj.up_link)">
        <span class="avatars">
          <img v-if="cardObj.up_cover" class="avatar" :src="cardObj.up_cover" alt="" />
          <img v-for="author in extraAuthors" :key="author.up_link" class="avatar duo-avatar" :src="author.up_cover" :alt="author.up_title" />
        </span>
        <span class="up-name">{{ extraAuthors && extraAuthors.length ? '联合投稿' : cardObj.up_title }}</span>
      </component>
      <p v-if="cardObj.viewed_at || cardObj.watch_device" class="viewed-at">
        <span class="viewed-time">{{ cardObj.viewed_at }}</span>
        <span v-if="cardObj.watch_device" class="watch-device" role="img"
          :title="cardObj.watch_device.label" :aria-label="cardObj.watch_device.label">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <g v-if="cardObj.watch_device.type === 'computer'">
              <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 17v4m-5 0h10" />
            </g>
            <g v-else-if="cardObj.watch_device.type === 'phone'">
              <rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" />
            </g>
            <g v-else-if="cardObj.watch_device.type === 'tablet'">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M10 17h4" />
            </g>
            <g v-else-if="cardObj.watch_device.type === 'tv'">
              <rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4M7 19v3m10-3v3" />
            </g>
            <g v-else-if="cardObj.watch_device.type === 'car'">
              <path d="m5 10 2-6h10l2 6M3 17v3m18-3v3M6 13h2m8 0h2" /><rect x="3" y="10" width="18" height="7" rx="2" />
            </g>
            <g v-else-if="cardObj.watch_device.type === 'speaker'">
              <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8" /><circle cx="12" cy="15" r="3" />
            </g>
            <g v-else>
              <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M10 8a2 2 0 1 1 3 1.7c-1 .5-1 1.3-1 2.3m0 4h.01" />
            </g>
          </svg>
        </span>
      </p>
      <p v-if="watchError" class="watch-error" role="alert">{{ watchError }}</p>
    </div>
  </article>
</template>

<script>
import { addToWatchData, delTowatchData } from '@/utils/api';
import CoverPreview from './CoverPreview.vue';
export default {
  name: 'CardEle',
  components: { CoverPreview },
  props: ['cardObj', 'extraAuthors', 'showWatchLater', 'hoverGlow', 'hoverZoom', 'previewSettings', 'previewEnabled'],
  data() { return { addedToWatch: Boolean(this.cardObj.toWatch), watchPending: false, watchError: '', previewHovered: false, previewPosition: 0, previewVisible: false }; },
  computed: {
    isPreviewing() { return this.previewVisible && this.previewHovered && this.previewEnabled && this.previewSettings?.hoverPreview; },
  },
  watch: {
    previewEnabled(value) { if (!value) this.previewHovered = false; },
  },
  methods: {
    movePreview(event) {
      if (!this.previewEnabled || !this.previewSettings?.hoverPreview || !this.cardObj.preview) return;
      const rect = event.currentTarget.getBoundingClientRect();
      this.previewPosition = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      this.previewHovered = true;
    },
    handleLink(link) {
      if (!link) return;
      if (link.startsWith('//')) link = 'https:' + link;
      chrome.tabs.create({ url: link });
    },
    async handleWatchLater() {
      if (this.watchPending) return;
      this.watchPending = true;
      this.watchError = '';
      try {
        const cookie = await chrome.cookies.get({ name: 'bili_jct', url: 'https://www.bilibili.com' });
        if (!cookie?.value) {
          this.watchError = '请先登录 Bilibili';
          return;
        }
        const add = !this.addedToWatch;
        const response = await (add ? addToWatchData : delTowatchData)(this.cardObj.aid, cookie.value);
        if (response?.code !== 0) throw new Error('watch later failed');
        this.addedToWatch = add;
      } catch (error) {
        this.watchError = '操作失败，请重试';
      } finally {
        this.watchPending = false;
      }
    },
  },
};
</script>

<style scoped>
.card { container-type: inline-size; min-width: 0; border-radius: 8px; background: var(--surface); box-shadow: 0 2px 6px #0000000d; }
.card.hover-glow { transition: box-shadow 150ms ease-out; }
/* Hover effects reference: https://github.com/magicdawn/Bilibili-Gate/blob/7edc62a55b19032f5225e89a3955d487ec31df33/src/components/VideoCard/card-border-css.tsx */
.card.hover-glow:hover, .card.hover-glow:focus-within { box-shadow: 0 0 0 1px var(--accent), 0 0 9px 4px color-mix(in srgb, var(--accent) 80%, white); }
.cover-wrap { position: relative; }
.video-img { position: relative; display: block; border-radius: 8px 8px 0 0; overflow: hidden; }
.cover-frame { position: relative; overflow: hidden; }
.cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.card.hover-zoom .cover { transform-origin: center; transition: transform 200ms ease-out; }
@media (prefers-reduced-motion: no-preference) {
  .card.hover-zoom:hover .cover, .card.hover-zoom:focus-within .cover { transform: scale(1.05); }
}
.video-stats { position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 18px 7px 6px; background: linear-gradient(transparent, #000b); color: #fff; font-size: clamp(10px, calc(var(--card-font-size) - 2px), 13px); font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px #000; pointer-events: none; }
.counts { display: flex; gap: 8px; min-width: 0; }
.stat { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.stat svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; flex-shrink: 0; }
.duration { white-space: nowrap; margin-left: auto; }
.watched-text { white-space: nowrap; }
.watch-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: #ffffff40; pointer-events: none; }
.watch-progress span { display: block; height: 100%; background: var(--accent); }
.viewed-at { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; margin: 6px 0 0; }
.viewed-time { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.watch-device { display: inline-flex; flex-shrink: 0; margin-left: auto; }
.watch-device svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.show-text { position: absolute; right: 6px; top: 6px; max-width: calc(100% - 58px); padding: 3px 6px; border-radius: 4px; background: #000b; color: #fff; font-size: 11px; opacity: 0; pointer-events: none; }
.watch-later { position: absolute; left: 4px; top: 4px; width: 40px; height: 40px; display: grid; place-items: center; padding: 8px; border: 0; border-radius: 6px; background: #000b; color: #fff; cursor: pointer; opacity: 0; }
.watch-later svg { width: 24px; height: 24px; }
.card:hover .watch-later, .card:focus-within .watch-later, .card:hover .show-text, .card:focus-within .show-text { opacity: 1; }
.card.previewing .video-stats, .card.previewing .show-text, .card.previewing .watch-progress { visibility: hidden; }
.watch-later.added { color: #9bd1ff; }
.watch-later:disabled { cursor: wait; }
.container { padding: 8px 10px 10px; }
.title-link { text-decoration: none; }
.title { margin: 0; font-size: var(--card-font-size); line-height: 1.45; height: 2.9em; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.title-link:hover { color: var(--accent); }
.up-link { display: flex; align-items: center; gap: 8px; margin-top: 10px; min-width: 0; color: var(--muted); text-decoration: none; font-size: calc(var(--card-font-size) - 2px); }
.up-link:hover { color: var(--accent); }
.avatars { display: flex; flex-shrink: 0; }
.avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
.duo-avatar { margin-left: -8px; border: 2px solid var(--surface); }
.up-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.watch-error { color: var(--error); font-size: 12px; margin: 6px 0 0; }
@media (hover: none) { .watch-later { opacity: 1; } }
@container (max-width: 180px) {
  .video-stats { flex-wrap: wrap; gap: 2px 4px; font-size: 10px; padding: 14px 5px 6px; }
  .counts { gap: 4px; }
  .stat { gap: 2px; }
  .stat svg { width: 12px; height: 12px; }
}
@container (max-width: 140px) {
  .video-stats { padding: 10px 4px 5px; }
  .counts { width: 100%; justify-content: space-between; gap: 2px; flex-wrap: wrap; }
  .stat svg { width: 10px; height: 10px; }
  .stat { gap: 1px; }
  .container { padding: 6px; }
  .avatar { width: 20px; height: 20px; }
  .up-link { gap: 4px; }
}
@container (max-width: 115px) {
  .video-stats { position: static; padding: 4px; background: #000b; }
}
</style>
