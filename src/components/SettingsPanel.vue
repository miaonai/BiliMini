<template>
  <section id="settings-panel" class="settings-panel" aria-labelledby="settings-title">
    <h2 id="settings-title">设置</h2>
    <fieldset>
      <legend>显示栏目</legend>
      <div v-for="item in tabOptions" :key="item.id" class="setting-row tab-row" :data-tab-id="item.id"
        :class="{ dragging: draggedTab === item.id, 'drop-before': dropTarget === item.id && !dropAfter, 'drop-after': dropTarget === item.id && dropAfter }"
        @dragover="dragOver($event, item.id)" @drop="dropTab($event, item.id)">
        <button type="button" class="drag-handle" draggable="true" :aria-label="'调整' + item.label + '顺序'"
          title="拖动排序，或用上下方向键调整" @dragstart="startDrag($event, item.id)" @dragend="endDrag"
          @keydown.up.prevent="moveTab(item.id, -1)" @keydown.down.prevent="moveTab(item.id, 1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M5 6h14M5 12h14M5 18h14" />
          </svg>
        </button>
        <label v-if="item.setting" class="tab-label">
          <span>{{ item.label }}</span>
          <input type="checkbox" role="switch" class="capsule" :checked="settings[item.setting]"
            @change="change(item.setting, $event.target.checked)" />
        </label>
        <div v-else class="tab-label"><span>{{ item.label }}</span><span class="always-visible">始终显示</span></div>
      </div>
      <span class="sr-only" role="status" aria-live="polite">{{ orderAnnouncement }}</span>
    </fieldset>
    <fieldset>
      <legend>红点提示</legend>
      <label class="setting-row">
        <span>投稿页红点提示</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.showVideoBadge"
          @change="change('showVideoBadge', $event.target.checked)" />
      </label>
      <label class="setting-row">
        <span>直播页红点提示</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.showLiveBadge"
          @change="change('showLiveBadge', $event.target.checked)" />
      </label>
    </fieldset>
    <fieldset>
      <legend>视频卡片</legend>
      <label class="setting-row">
        <span>隐藏充电专属视频</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.hideChargeOnly"
          @change="change('hideChargeOnly', $event.target.checked)" />
      </label>
      <label class="setting-row">
        <span>显示稍后再看按钮</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.showWatchLater"
          @change="change('showWatchLater', $event.target.checked)" />
      </label>
      <label class="setting-row">
        <span>悬浮卡片时使用发光边框</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.cardHoverGlow"
          @change="change('cardHoverGlow', $event.target.checked)" />
      </label>
      <label class="setting-row">
        <span>悬浮卡片时放大封面</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.cardHoverZoom"
          @change="change('cardHoverZoom', $event.target.checked)" />
      </label>
    </fieldset>
    <fieldset>
      <legend>悬浮预览</legend>
      <label class="setting-row">
        <span>开启悬浮预览</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.hoverPreview"
          @change="change('hoverPreview', $event.target.checked)" />
      </label>
      <label class="setting-row" :class="{ disabled: !settings.hoverPreview }">
        <span>延迟悬浮预览</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.previewDelay" :disabled="!settings.hoverPreview"
          @change="change('previewDelay', $event.target.checked)" />
      </label>
      <div class="setting-row" :class="{ disabled: !settings.hoverPreview || !settings.previewDelay }">
        <label for="preview-delay">预览延迟时间</label>
        <span class="number-value"><input id="preview-delay" type="number" min="0" max="5000" step="50"
          :disabled="!settings.hoverPreview || !settings.previewDelay" v-model="previewDelayDraft"
          @change="commitPreviewDelay" @keydown.enter.prevent="$event.target.blur()"
          @keydown.esc.prevent="cancelPreviewDelay" /> ms</span>
      </div>
      <label class="setting-row" :class="{ disabled: !settings.hoverPreview }">
        <span>自动预览</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.previewAuto" :disabled="!settings.hoverPreview"
          @change="change('previewAuto', $event.target.checked)" />
      </label>
      <div class="setting-row" :class="{ disabled: !settings.hoverPreview || !settings.previewAuto }">
        <label for="preview-interval">自动预览更新间隔</label>
        <span class="number-value"><input id="preview-interval" type="number" min="100" max="2000" step="50"
          :disabled="!settings.hoverPreview || !settings.previewAuto" v-model="previewIntervalDraft"
          @change="commitPreviewInterval" @keydown.enter.prevent="$event.target.blur()"
          @keydown.esc.prevent="cancelPreviewInterval" /> ms</span>
      </div>
    </fieldset>
    <fieldset>
      <legend>布局</legend>
      <label class="setting-row">
        <span>隐藏滚动条</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings.hideScrollbar"
          @change="change('hideScrollbar', $event.target.checked)" />
      </label>
      <div class="size-row">
        <label for="popup-width-value">宽度</label>
        <span class="number-value"><input id="popup-width-value" type="number" min="380" max="800" step="1"
          v-model="widthDraft" @change="commitWidth" @keydown.enter.prevent="$event.target.blur()"
          @keydown.esc.prevent="cancelWidth" /> px</span>
      </div>
      <input id="popup-width" aria-label="调整宽度" type="range" min="380" max="800" step="1" :value="settings.popupWidth"
        @input="change('popupWidth', Number($event.target.value))" />
      <div class="setting-row">
        <label for="card-columns">列数</label>
        <select id="card-columns" :value="settings.columns" @change="change('columns', $event.target.value === 'auto' ? 'auto' : Number($event.target.value))">
          <option value="auto">自适应</option>
          <option value="1">1 列</option>
          <option value="2">2 列</option>
          <option value="3">3 列</option>
          <option value="4">4 列</option>
        </select>
      </div>
    </fieldset>
    <footer><span v-if="saveError" role="alert" class="save-error">{{ saveError }}</span>
      <button type="button" class="text-button" @click="$emit('reset')">恢复默认</button>
    </footer>
  </section>
</template>

<script>
import { orderedTabs } from '@/utils/settings';

export default {
  name: 'SettingsPanel',
  props: ['settings', 'saveError'],
  data() { return { widthDraft: String(this.settings.popupWidth), previewDelayDraft: String(this.settings.previewDelayMs), previewIntervalDraft: String(this.settings.previewInterval), draggedTab: '', dropTarget: '', dropAfter: false, orderAnnouncement: '' }; },
  computed: {
    tabOptions() { return orderedTabs(this.settings); },
  },
  watch: {
    'settings.popupWidth'(value) { this.widthDraft = String(value); },
    'settings.previewDelayMs'(value) { this.previewDelayDraft = String(value); },
    'settings.previewInterval'(value) { this.previewIntervalDraft = String(value); },
  },
  methods: {
    change(key, value) { this.$emit('change', { ...this.settings, [key]: value }); },
    commitPreviewDelay() {
      const value = Number(this.previewDelayDraft);
      if (String(this.previewDelayDraft).trim() !== '' && Number.isFinite(value)) {
        this.change('previewDelayMs', Math.max(0, Math.min(5000, Math.round(value))));
      }
      this.previewDelayDraft = String(this.settings.previewDelayMs);
    },
    cancelPreviewDelay(event) {
      this.previewDelayDraft = String(this.settings.previewDelayMs);
      event.target.blur();
    },
    commitPreviewInterval() {
      const value = Number(this.previewIntervalDraft);
      if (String(this.previewIntervalDraft).trim() !== '' && Number.isFinite(value)) {
        this.change('previewInterval', Math.max(100, Math.min(2000, Math.round(value))));
      }
      this.previewIntervalDraft = String(this.settings.previewInterval);
    },
    cancelPreviewInterval(event) {
      this.previewIntervalDraft = String(this.settings.previewInterval);
      event.target.blur();
    },
    startDrag(event, id) {
      this.draggedTab = id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.setDragImage(event.currentTarget.closest('.tab-row'), 20, 20);
    },
    dragOver(event, id) {
      if (!this.draggedTab) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      this.dropTarget = id === this.draggedTab ? '' : id;
      const rect = event.currentTarget.getBoundingClientRect();
      this.dropAfter = event.clientY > rect.top + rect.height / 2;
    },
    dropTab(event, id) {
      if (!this.draggedTab) return;
      event.preventDefault();
      this.dragOver(event, id);
      if (id !== this.draggedTab) {
        const order = this.settings.tabOrder.filter(tab => tab !== this.draggedTab);
        order.splice(order.indexOf(id) + (this.dropAfter ? 1 : 0), 0, this.draggedTab);
        this.saveOrder(order, this.draggedTab);
      }
      this.endDrag();
    },
    endDrag() { this.draggedTab = ''; this.dropTarget = ''; },
    moveTab(id, direction) {
      const order = [...this.settings.tabOrder];
      const index = order.indexOf(id);
      const target = index + direction;
      if (target < 0 || target >= order.length) return;
      order.splice(index, 1);
      order.splice(target, 0, id);
      this.saveOrder(order, id);
    },
    saveOrder(order, id) {
      if (order.every((tab, index) => tab === this.settings.tabOrder[index])) return;
      const label = this.tabOptions.find(tab => tab.id === id).label;
      this.change('tabOrder', order);
      this.orderAnnouncement = `${label}已移至第 ${order.indexOf(id) + 1} 位`;
      this.$nextTick(() => this.$el.querySelector(`[data-tab-id="${id}"] .drag-handle`).focus());
    },
    commitWidth() {
      const value = Number(this.widthDraft);
      if (String(this.widthDraft).trim() !== '' && Number.isFinite(value)) {
        this.change('popupWidth', Math.max(380, Math.min(800, Math.round(value))));
      }
      this.widthDraft = String(this.settings.popupWidth);
    },
    cancelWidth(event) {
      this.widthDraft = String(this.settings.popupWidth);
      event.target.blur();
    },
  },
};
</script>

<style scoped>
.settings-panel { padding: 12px 20px; font-size: 14px; }
h2 { margin: 0 0 12px; font-size: 20px; }
fieldset { border: 0; padding: 0 0 8px; margin: 0 0 10px; border-bottom: 1px solid var(--border); }
legend { padding: 0; margin-bottom: 4px; font-size: 12px; color: var(--muted); }
.setting-row { display: flex; align-items: center; justify-content: space-between; min-height: 40px; gap: 16px; cursor: pointer; }
.setting-row.disabled { color: var(--muted); cursor: default; }
.tab-row { position: relative; gap: 4px; cursor: default; }
.tab-row.dragging { opacity: .5; }
.tab-row.drop-before::before, .tab-row.drop-after::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; background: var(--accent); pointer-events: none; }
.tab-row.drop-before::before { top: 0; }
.tab-row.drop-after::after { bottom: 0; }
.tab-label { display: flex; flex: 1; align-items: center; justify-content: space-between; min-height: 40px; gap: 16px; }
label.tab-label { cursor: pointer; }
.drag-handle { display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; border: 0; border-radius: 5px; background: transparent; color: var(--muted); cursor: grab; }
.drag-handle:hover { color: var(--text); background: var(--hover); }
.drag-handle:active { cursor: grabbing; }
.drag-handle svg { width: 18px; height: 18px; pointer-events: none; }
.always-visible { font-size: 12px; color: var(--muted); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.capsule { appearance: none; flex: 0 0 38px; width: 38px; height: 22px; margin: 0; border-radius: 20px; background: var(--switch-off); cursor: pointer; position: relative; }
.capsule::before { content: ''; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px; border-radius: 50%; background: white; }
.capsule:checked { background: var(--accent); }
.capsule:checked::before { transform: translateX(16px); }
.capsule:disabled { opacity: .45; cursor: default; }
.size-row { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.number-value { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.number-value input { width: 66px; padding: 6px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--text); text-align: right; appearance: textfield; }
.number-value input::-webkit-inner-spin-button, .number-value input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.number-value input:not(:disabled):hover, .number-value input:focus { border-color: var(--border); background: var(--surface); }
.number-value input:disabled { color: var(--muted); opacity: .6; }
select { min-height: 36px; padding: 4px 8px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 5px; font: inherit; }
input[type=range] { width: 100%; margin: 6px 0 0; min-height: 28px; accent-color: var(--accent); cursor: pointer; }
footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
.text-button { margin-left: auto; border: 0; background: transparent; color: var(--accent); cursor: pointer; min-height: 40px; padding: 0 8px; }
.save-error { color: var(--error); }
</style>
