<template>
  <div id="videopanel">
    <header class="toolbar">
      <el-tabs v-model="activeTab" class="header" @tab-click="selectTab">
        <el-tab-pane v-for="tab in displayedTabs" :key="tab.id" :name="tab.id">
          <span slot="label">{{ tab.label }}<el-badge v-if="tab.id === '1'" v-show="settings.showVideoBadge && badgeShow.video" is-dot class="label-badge" /><el-badge v-else-if="tab.id === '2'" v-show="badgeShow.bangumi" is-dot class="label-badge" /><el-badge v-else-if="tab.id === '3'" v-show="settings.showLiveBadge && badgeShow.live" :value="liveNumStr" class="label-badge" /></span>
        </el-tab-pane>
      </el-tabs>
      <button ref="settingsButton" type="button" class="settings-button" aria-label="设置"
        :aria-expanded="String(settingsOpen)" aria-controls="settings-panel" @click="toggleSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <path d="m9.5 3-.6 2.3-1.5.9-2.3-.7-2.5 4.3 1.7 1.6v1.8l-1.7 1.6 2.5 4.3 2.3-.7 1.5.9.6 2.3h5l.6-2.3 1.5-.9 2.3.7 2.5-4.3-1.7-1.6v-1.8l1.7-1.6-2.5-4.3-2.3.7-1.5-.9-.6-2.3z" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      </button>
    </header>
    <main id="popup-content" :class="{ 'hide-scrollbar': settings.hideScrollbar }">
    <settings-panel v-if="settingsOpen" :settings="settings" :save-error="saveError"
      @change="changeSettings" @reset="resetSettings" />
    <div v-show="!settingsOpen">
      <p v-if="!permissionGranted" role="alert" class="notice">缺少 API 权限，请在浏览器扩展设置中授权后重试。</p>
      <p v-else-if="activeTab !== '5' && loggedInStatus === -101" role="alert" class="notice">尚未登录 Bilibili，<a href="https://passport.bilibili.com/login" @click.prevent="openLogin">登录</a>后再试。</p>
      <p v-else-if="activeTab !== '5' && loggedInStatus !== 0" role="alert" class="notice">暂时无法获取登录状态，请稍后重试。</p>
      <dynamic-list v-show="activeTab !== '4'" :active-tab="activeTab" :settings="settings" :enabled="!settingsOpen && activeTab !== '4'" />
      <history-list v-if="settings.showHistory && activeTab === '4'" :enabled="!settingsOpen"
        :hover-glow="settings.cardHoverGlow" :hover-zoom="settings.cardHoverZoom" :preview-settings="settings" />
    </div>
    </main>
  </div>
</template>

<script>
import DynamicList from '@/components/Lists/DynamicList.vue';
import HistoryList from '@/components/Lists/HistoryList.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import key from 'keymaster';
import { sleep, resetScroller } from '@/utils/tools';
import { getLiveData } from '@/utils/api';
import { SETTINGS_KEY, DEFAULT_SETTINGS, TAB_OPTIONS, normalizeSettings, orderedTabs, visibleTabs, applyPopupSize } from '@/utils/settings';

export default {
  name: 'MainPanel',
  components: { DynamicList, HistoryList, SettingsPanel },
  props: ['initialSettings', 'settingsError'],
  data() {
    const settings = { ...this.initialSettings };
    const savedTab = localStorage['activeTab'];
    return {
      settings,
      activeTab: visibleTabs(settings).includes(savedTab) ? savedTab : visibleTabs(settings)[0],
      settingsOpen: false,
      saveError: this.settingsError,
      loggedInStatus: 0,
      permissionGranted: true,
      badgeShow: { video: false, bangumi: false, live: false },
      liveNumStr: '',
      saveQueue: Promise.resolve(),
    };
  },
  computed: {
    displayedTabs() { return orderedTabs(this.settings).filter(tab => !tab.setting || this.settings[tab.setting]); },
  },
  async mounted() {
    for (let index = 0; index < TAB_OPTIONS.length; index++) {
      key(String(index + 1), () => {
        const tab = visibleTabs(this.settings)[index];
        if (this.settingsOpen || !tab) return;
        this.activeTab = tab;
        this.selectTab();
        return false;
      });
    }
    key('esc', () => {
      if (this.settingsOpen) this.toggleSettings();
    });
    try {
      this.permissionGranted = await chrome.permissions.contains({ origins: ['*://*.bilibili.com/*'] });
      if (!this.permissionGranted) return;
      const nums = await chrome.runtime.sendMessage({ getNums: true });
      this.badgeShow.video = nums?.video > 0;
      this.badgeShow.bangumi = nums?.bangumi > 0;
      await sleep(1200);
      this.loggedInStatus = await chrome.runtime.sendMessage({ getLoginStatus: true });
      if (this.loggedInStatus === 0 && this.settings.showLive && this.settings.showLiveBadge) this.setLiveBadge();
    } catch (error) {
      this.loggedInStatus = -1;
    }
  },
  beforeDestroy() {
    ['1', '2', '3', '4', '5', 'esc'].forEach(tab => key.unbind(tab));
  },
  methods: {
    selectTab() {
      this.settingsOpen = false;
      localStorage['activeTab'] = this.activeTab;
      resetScroller();
    },
    toggleSettings() {
      this.settingsOpen = !this.settingsOpen;
      resetScroller();
      if (!this.settingsOpen) this.$refs.settingsButton.focus();
    },
    changeSettings(value) {
      const wasLiveBadgeEnabled = this.settings.showLive && this.settings.showLiveBadge;
      this.settings = normalizeSettings(value);
      applyPopupSize(this.settings);
      if (!visibleTabs(this.settings).includes(this.activeTab)) {
        this.activeTab = visibleTabs(this.settings)[0];
        localStorage['activeTab'] = this.activeTab;
      }
      if (!wasLiveBadgeEnabled && this.settings.showLive && this.settings.showLiveBadge && this.loggedInStatus === 0) this.setLiveBadge();
      const snapshot = { ...this.settings };
      // Serialize slider writes so the last change is also the last saved value.
      this.saveQueue = this.saveQueue.then(() => chrome.storage.local.set({ [SETTINGS_KEY]: snapshot }))
        .then(() => { this.saveError = ''; })
        .catch(() => { this.saveError = '保存失败，请重新调整设置后重试'; });
    },
    resetSettings() { this.changeSettings(DEFAULT_SETTINGS); },
    openLogin() { chrome.tabs.create({ url: 'https://passport.bilibili.com/login' }); },
    async setLiveBadge() {
      const response = await getLiveData(1, 11);
      const count = response?.data?.list?.length || 0;
      this.badgeShow.live = count > 0;
      this.liveNumStr = count > 10 ? '10+' : String(count);
    },
  },
};
</script>

<style scoped>
#videopanel { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.toolbar { position: relative; flex: 0 0 56px; z-index: 100; display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 56px; background: var(--surface); border-bottom: 1px solid var(--border); }
#popup-content { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: scroll; scrollbar-gutter: stable both-edges; }
#popup-content::-webkit-scrollbar { width: 4px; }
#popup-content::-webkit-scrollbar-track { background: transparent; }
#popup-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
#popup-content::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }
#popup-content.hide-scrollbar { scrollbar-width: none; scrollbar-gutter: auto; }
#popup-content.hide-scrollbar::-webkit-scrollbar { display: none; width: 0; }
.header { flex: 1; min-width: 0; }
.settings-button { display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; padding: 9px; border: 0; border-radius: 8px; color: var(--muted); background: transparent; cursor: pointer; }
.settings-button:hover, .settings-button[aria-expanded=true] { background: var(--hover); color: var(--accent); }
.settings-button svg { width: 22px; height: 22px; }
.notice { margin: 12px; padding: 12px; background: var(--surface); color: var(--error); font-size: 14px; }
</style>
