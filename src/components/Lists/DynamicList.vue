<template>
  <section class="main" :aria-busy="String(current.loading)">
    <div class="card-grid">
      <card-ele v-for="card in cards" :key="card.index" :card-obj="card"
        :show-watch-later="settings.showWatchLater" :hover-glow="settings.cardHoverGlow" :hover-zoom="settings.cardHoverZoom"
        :extra-authors="current.extraAuthors[card.dynamicId]" :preview-settings="settings" :preview-enabled="enabled" />
    </div>
    <p v-if="current.loading" class="list-status" role="status">正在加载…</p>
    <p v-else-if="current.error" class="list-status error" role="alert">{{ current.error }}</p>
    <p v-else-if="!cards.length && current.loaded" class="list-status">
      {{ current.cards.length ? '当前已加载的视频均已隐藏' : activeTab === '5' ? '暂无热门视频' : '暂无更新' }}
    </p>
    <p v-else-if="current.noMore" class="list-status">没有更多了</p>
    <button v-if="!current.noMore || current.error" type="button" class="moreBtn" :disabled="current.loading"
      @click="loadTab(activeTab, current.loaded)">{{ current.error ? '重试' : '加载更多' }}</button>
    <button v-else type="button" class="moreBtn" @click="seeMore">{{ moreText }}</button>
  </section>
</template>

<script>
import CardEle from '@/components/Elements/CardEle.vue';
import { getToWatchData, getDynamicData, getLiveData, getPopularData } from '@/utils/api';
import { resetScroller } from '@/utils/tools';
import { createFeedState, appendDynamicPage, appendLivePage, visibleCards } from '@/utils/feed';
import { appendPopularPage } from '@/utils/popular';

export default {
  name: 'DynamicList',
  components: { CardEle },
  props: ['activeTab', 'settings', 'enabled'],
  data: () => ({
    feeds: { '1': createFeedState(), '2': createFeedState(), '3': createFeedState(), '5': createFeedState() },
    toWatchAids: [],
    watchReady: null,
    autoPages: 0,
  }),
  computed: {
    current() { return this.feeds[this.activeTab] || this.feeds['1']; },
    cards() { return visibleCards(this.current.cards, this.settings.hideChargeOnly); },
    moreText() { return { '1': '更多投稿动态', '2': '更多番剧动态', '3': '全部直播', '5': '更多热门视频' }[this.activeTab]; },
  },
  mounted() {
    this.scroller = document.getElementById('popup-content');
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
    this.watchReady = this.getToWatchs();
    this.loadTab(this.activeTab);
  },
  beforeDestroy() { this.scroller.removeEventListener('scroll', this.onScroll); },
  watch: {
    activeTab() {
      resetScroller();
      this.autoPages = 0;
      this.loadTab(this.activeTab);
    },
    enabled(value) {
      if (value) {
        this.autoPages = 0;
        this.loadTab(this.activeTab);
        this.$nextTick(this.fillViewport);
      }
    },
    'settings.hideChargeOnly'() {
      this.autoPages = 0;
      this.$nextTick(this.fillViewport);
    },
  },
  methods: {
    seeMore() {
      const url = { '1': 'https://t.bilibili.com/', '2': 'https://t.bilibili.com/?tab=pgc', '3': 'https://live.bilibili.com/', '5': 'https://www.bilibili.com/v/popular/all' }[this.activeTab];
      chrome.tabs.create({ url });
    },
    nearBottom() {
      const root = this.scroller;
      if (!root) return false;
      return root.scrollTop + root.clientHeight + 100 >= root.scrollHeight;
    },
    onScroll() {
      if (this.enabled && this.nearBottom() && !this.current.error) {
        this.autoPages = 0;
        this.loadTab(this.activeTab, true);
      }
    },
    fillViewport() {
      // Avoid an unbounded request loop when every page is filtered. The manual
      // load-more button remains available after three automatic extra pages.
      if (this.enabled && this.autoPages < 3 && this.nearBottom() && !this.current.error && !this.current.noMore && !this.current.loading) {
        this.autoPages += 1;
        this.loadTab(this.activeTab, true);
      }
    },
    async getToWatchs() {
      const response = await getToWatchData();
      this.toWatchAids = (response?.data?.list || []).map(item => Number(item.aid));
    },
    async loadTab(tab, loadMore = false) {
      const state = this.feeds[tab];
      if (!state || state.loading || (loadMore && state.noMore) || (!loadMore && state.loaded)) return;
      state.loading = true;
      state.error = '';
      try {
        await this.watchReady;
        const response = tab === '5' ? await getPopularData(state.page) : tab === '3' ? await getLiveData(state.page) :
          await getDynamicData(tab === '1' ? 'video' : 'pgc', false, loadMore ? state.offset : false);
        if (!response || response.code !== 0 || !response.data) throw new Error('feed request failed');
        // Capture the requested tab before awaiting: switching tabs must never
        // put a video response into the live or bangumi list.
        if (tab === '5') appendPopularPage(state, response.data, this.toWatchAids);
        else if (tab === '3') appendLivePage(state, response.data);
        else appendDynamicPage(state, response.data, this.toWatchAids);
        state.loaded = true;
      } catch (error) {
        state.error = '加载失败，请重试';
      } finally {
        state.loading = false;
        if (this.activeTab === tab) this.$nextTick(this.fillViewport);
      }
    },
  },
};
</script>

<style scoped>
.main { padding: 14px 12px; }
.list-status { text-align: center; font-size: 13px; color: var(--muted); padding: 12px 0; }
.error { color: var(--error); }
.moreBtn { width: 100%; min-height: 40px; border: 0; border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; margin-top: 12px; }
.moreBtn:hover { background: var(--hover); }
.moreBtn:disabled { cursor: wait; color: var(--muted); }
</style>
