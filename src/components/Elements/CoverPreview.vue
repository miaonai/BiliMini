<template>
  <div v-if="frame" class="preview" aria-hidden="true">
    <div class="preview-image" :class="{ zoomed: zoom }" :style="frame.style" />
    <span class="preview-time">{{ previewTime }}</span>
    <div class="preview-progress"><span :style="{ width: progress * 100 + '%' }" /></div>
  </div>
</template>

<script>
import { getVideoPreviewData } from '@/utils/api';
import { createPreviewLoader, previewFrame, previewTargetKey } from '@/utils/preview';
import { formatDuration } from '@/utils/history';

const loadPreview = createPreviewLoader(getVideoPreviewData);
const sheetLoads = new Map();
function loadSheet(url) {
  if (sheetLoads.has(url)) return sheetLoads.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('Preview image timed out')), 8000);
    function finish(error) {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (error) reject(error);
      else resolve();
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error('Preview image failed'));
    image.src = url;
  });
  sheetLoads.set(url, promise);
  if (sheetLoads.size > 100) sheetLoads.delete(sheetLoads.keys().next().value);
  promise.catch(() => { sheetLoads.delete(url); });
  return promise;
}

export default {
  name: 'CoverPreview',
  props: ['target', 'settings', 'active', 'position', 'zoom'],
  data() {
    return { frame: null, shot: null, progress: 0, pageVisible: !document.hidden,
      session: 0, frameRequest: 0, startTimer: null, tickTimer: null, startedAt: 0 };
  },
  computed: {
    visible() { return Boolean(this.frame); },
    sessionKey() {
      const key = previewTargetKey(this.target);
      return this.active && this.settings.hoverPreview && this.pageVisible && key
        ? `${key}:${this.settings.previewDelay}:${this.settings.previewDelayMs}:${this.settings.previewAuto}:${this.settings.previewInterval}` : '';
    },
    previewTime() { return this.shot ? formatDuration(Math.floor(this.progress * this.shot.duration)) : ''; },
  },
  watch: {
    visible: {
      immediate: true,
      handler(value) { this.$emit('visibility-change', value); },
    },
    sessionKey: {
      immediate: true,
      handler(value) {
        this.stop();
        if (value) {
          const session = this.session;
          this.startTimer = setTimeout(() => this.start(session), this.settings.previewDelay ? this.settings.previewDelayMs : 0);
        }
      },
    },
    position(value) {
      if (!this.sessionKey || !this.shot || this.settings.previewAuto) return;
      this.progress = Math.max(0, Math.min(1, value));
      this.renderFrame(this.session);
    },
  },
  mounted() { document.addEventListener('visibilitychange', this.updateVisibility); },
  beforeDestroy() {
    this.stop();
    this.$emit('visibility-change', false);
    document.removeEventListener('visibilitychange', this.updateVisibility);
  },
  methods: {
    updateVisibility() { this.pageVisible = !document.hidden; },
    stop() {
      this.session++;
      this.frameRequest++;
      clearTimeout(this.startTimer);
      clearTimeout(this.tickTimer);
      this.frame = null;
      this.shot = null;
    },
    async start(session) {
      if (session !== this.session || !this.sessionKey) return;
      try {
        const shot = await loadPreview(this.target);
        if (!shot || session !== this.session || !this.sessionKey) return;
        this.shot = shot;
        this.startedAt = performance.now();
        this.progress = this.settings.previewAuto ? 0 : this.position;
        await this.renderFrame(session);
        this.scheduleNext(session);
      } catch (error) {
        if (session === this.session) this.stop();
      }
    },
    scheduleNext(session) {
      if (session !== this.session || !this.sessionKey || !this.settings.previewAuto) return;
      this.tickTimer = setTimeout(async () => {
        if (session !== this.session || !this.sessionKey) return;
        this.progress = ((performance.now() - this.startedAt) % 8000) / 8000;
        await this.renderFrame(session);
        this.scheduleNext(session);
      }, this.settings.previewInterval);
    },
    async renderFrame(session) {
      if (session !== this.session || !this.sessionKey || !this.shot) return;
      const frame = previewFrame(this.shot, this.progress);
      const request = ++this.frameRequest;
      if (this.frame?.index === frame.index) return;
      try {
        await loadSheet(frame.url);
        if (session === this.session && request === this.frameRequest && this.sessionKey) this.frame = frame;
      } catch (error) {
        if (session === this.session && request === this.frameRequest) this.stop();
      }
    },
  },
};
</script>

<style scoped>
.preview { position: absolute; inset: 0; pointer-events: none; }
.preview-image { position: absolute; inset: 0; background-color: #000; }
.preview-image.zoomed { transform: scale(1.05); }
.preview-time { position: absolute; right: 6px; bottom: 6px; z-index: 2; padding: 2px 4px; border-radius: 3px; background: #000b; color: #fff; font-size: 11px; font-variant-numeric: tabular-nums; }
.preview-progress { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; height: 3px; background: #ffffff40; }
.preview-progress span { display: block; height: 100%; background: var(--accent); }
@media (prefers-reduced-motion: reduce) { .preview-image.zoomed { transform: none; } }
@container (max-width: 140px) { .preview-time { display: none; } }
</style>
