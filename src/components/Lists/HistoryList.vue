<template>
  <section class="history-list" :aria-busy="String(state.loading)">
    <div class="card-grid">
      <card-ele v-for="card in state.cards" :key="card.index" :card-obj="card" />
    </div>
    <p v-if="state.loading" class="list-status" role="status">正在加载…</p>
    <p v-else-if="state.error" class="list-status error" role="alert">{{ state.error }}</p>
    <p v-else-if="!state.cards.length && state.loaded" class="list-status">暂无观看记录</p>
    <p v-else-if="state.noMore" class="list-status">没有更多了</p>
    <button v-if="!state.noMore || state.error" type="button" class="moreBtn" :disabled="state.loading"
      @click="loadMore">{{ state.error ? '重试' : '加载更多' }}</button>
    <button v-else type="button" class="moreBtn" @click="seeMore">查看全部历史</button>
  </section>
</template>

<script>
import { getHistoryData } from '@/utils/api';
import CardEle from '@/components/Elements/CardEle.vue';
import { getTimeText } from '@/utils/tools';
import { createHistoryState, appendHistoryPage } from '@/utils/history';

export default {
  name: 'HistoryList',
  components: { CardEle },
  props: { enabled: { type: Boolean, default: true } },
  data: () => ({ state: createHistoryState(), autoPages: 0 }),
  mounted() {
    this.scroller = document.getElementById('popup-content');
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
    if (this.enabled) this.loadMore();
  },
  beforeDestroy() { this.scroller.removeEventListener('scroll', this.onScroll); },
  watch: {
    enabled(value) {
      if (value) {
        this.autoPages = 0;
        if (!this.state.loaded && !this.state.error) this.loadMore();
        else this.$nextTick(this.fillViewport);
      }
    },
  },
  methods: {
    seeMore() { chrome.tabs.create({ url: 'https://www.bilibili.com/account/history' }); },
    nearBottom() {
      const root = this.scroller;
      return root && root.scrollTop + root.clientHeight + 100 >= root.scrollHeight;
    },
    onScroll() {
      if (this.enabled && this.nearBottom() && !this.state.error) {
        this.autoPages = 0;
        this.loadMore();
      }
    },
    fillViewport() {
      // Match the feed's bounded automatic fill when pages contain no usable cards.
      if (this.enabled && this.autoPages < 3 && this.nearBottom() && !this.state.error && !this.state.noMore && !this.state.loading) {
        this.autoPages += 1;
        this.loadMore();
      }
    },
    async loadMore() {
      const state = this.state;
      if (!this.enabled || state.loading || state.noMore || this._isDestroyed) return;
      state.loading = true;
      state.error = '';
      try {
        const response = await getHistoryData(state.cursor);
        if (this._isDestroyed) return;
        if (response?.code !== 0 || !Array.isArray(response.data?.list)) throw new Error('history request failed');
        appendHistoryPage(state, response.data, getTimeText);
      } catch (error) {
        state.error = '加载失败，请重试';
      } finally {
        state.loading = false;
        if (!this._isDestroyed) this.$nextTick(this.fillViewport);
      }
    },
  },
};
</script>

<style scoped>
.history-list { padding: 14px 12px; }
.list-status { text-align: center; font-size: 13px; color: var(--muted); padding: 12px 0; }
.error { color: var(--error); }
.moreBtn { width: 100%; min-height: 40px; border: 0; border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; margin-top: 14px; }
.moreBtn:hover { background: var(--hover); }
.moreBtn:disabled { cursor: wait; color: var(--muted); }
</style>
