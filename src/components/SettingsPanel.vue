<template>
  <section id="settings-panel" class="settings-panel" aria-labelledby="settings-title">
    <h2 id="settings-title">设置</h2>
    <fieldset>
      <legend>显示栏目</legend>
      <label v-for="item in tabOptions" :key="item.key" class="setting-row">
        <span>{{ item.label }}</span>
        <input type="checkbox" role="switch" class="capsule" :checked="settings[item.key]"
          @change="change(item.key, $event.target.checked)" />
      </label>
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
        <span class="width-value"><input id="popup-width-value" type="number" min="380" max="800" step="1"
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
export default {
  name: 'SettingsPanel',
  props: ['settings', 'saveError'],
  data() { return { widthDraft: String(this.settings.popupWidth), tabOptions: [
    { key: 'showBangumi', label: '番剧' },
    { key: 'showLive', label: '直播' },
    { key: 'showHistory', label: '历史' },
    { key: 'showPopular', label: '热门' },
  ] }; },
  watch: {
    'settings.popupWidth'(value) { this.widthDraft = String(value); },
  },
  methods: {
    change(key, value) { this.$emit('change', { ...this.settings, [key]: value }); },
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
.capsule { appearance: none; flex: 0 0 38px; width: 38px; height: 22px; margin: 0; border-radius: 20px; background: var(--switch-off); cursor: pointer; position: relative; }
.capsule::before { content: ''; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px; border-radius: 50%; background: white; }
.capsule:checked { background: var(--accent); }
.capsule:checked::before { transform: translateX(16px); }
.size-row { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.width-value { color: var(--muted); font-variant-numeric: tabular-nums; }
.width-value input { width: 66px; padding: 6px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--text); text-align: right; appearance: textfield; }
.width-value input::-webkit-inner-spin-button, .width-value input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.width-value input:hover, .width-value input:focus { border-color: var(--border); background: var(--surface); }
select { min-height: 36px; padding: 4px 8px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 5px; font: inherit; }
input[type=range] { width: 100%; margin: 6px 0 0; min-height: 28px; accent-color: var(--accent); cursor: pointer; }
footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
.text-button { margin-left: auto; border: 0; background: transparent; color: var(--accent); cursor: pointer; min-height: 40px; padding: 0 8px; }
.save-error { color: var(--error); }
</style>
