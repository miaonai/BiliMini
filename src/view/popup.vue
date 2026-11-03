<template>
  <main-panel :initial-settings="initialSettings" :settings-error="settingsError" />
</template>

<script>
import MainPanel from '@/components/MainPanel.vue';
export default {
  name: 'App',
  components: { MainPanel },
  props: ['initialSettings', 'settingsError'],
  mounted() {
    chrome.runtime.sendMessage({ popupOpen: true });
    this.heartbeat = setInterval(() => {
      chrome.runtime.sendMessage({ action: 'heartbeat' }).catch(() => {});
    }, 3000);
  },
  beforeDestroy() { clearInterval(this.heartbeat); },
};
</script>

<style>
:root { --popup-width: 560px; --card-font-size: 15px; --background: #f5f6f8; --surface: #fff; --text: #202124; --muted: #636870; --border: #e4e6ea; --accent: #1676c8; --hover: #eaf3fc; --switch-off: #838991; --error: #c63939; color-scheme: light dark; }
* { box-sizing: border-box; }
html { width: var(--popup-width); height: 600px; overflow: hidden; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--background); color: var(--text); }
body { margin: 0; width: 100%; max-width: 100vw; height: 100%; max-height: 100vh; overflow: hidden; --scrollbar-thumb: #00000024; --scrollbar-hover: #0000003d; }
button, input { font: inherit; }
a { color: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.card-grid { display: grid; grid-template-columns: var(--card-columns, repeat(2, minmax(0, 1fr))); gap: 14px 12px; align-items: start; }
.header .el-tabs__header { margin: 0; }
.header .el-tabs__nav-wrap::after { display: none; }
.header .el-tabs__item { color: var(--text); font-size: 16px; height: 55px; line-height: 55px; padding: 0 16px; }
.header .el-tabs__item.is-active, .header .el-tabs__item:hover { color: var(--accent); }
.header .el-tabs__active-bar { background: var(--accent); }
.header .el-tabs__content { display: none; }
.label-badge { line-height: 1; }
@media (max-width: 440px) {
  .header .el-tabs__item { font-size: 14px; padding: 0 10px; }
}
@media (prefers-color-scheme: dark) {
  :root { --background: #111; --surface: #242424; --text: #e6e6e6; --muted: #aaaeb5; --border: #383838; --accent: #63b3ff; --hover: #303d4a; --switch-off: #636971; --error: #ff9090; }
  body { --scrollbar-thumb: #ffffff24; --scrollbar-hover: #ffffff3d; }
  .el-loading-mask { background: #111b; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
</style>
