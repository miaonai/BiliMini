<template>
  <section class="history-list" :aria-busy="String(loading)">
    <div class="card-grid">
      <card-ele v-for="card in cards" :key="card.index" :card-obj="card" />
    </div>
    <p v-if="loading" class="list-status" role="status">正在加载…</p>
    <p v-else-if="error" class="list-status error" role="alert">{{ error }}</p>
    <p v-else-if="!cards.length" class="list-status">暂无观看记录</p>
    <button v-if="error" type="button" class="moreBtn" @click="update">重试</button>
    <button v-else-if="!loading" type="button" class="moreBtn" @click="seeMore">查看全部历史</button>
  </section>
</template>

<script>
import { getHistoryData } from '@/utils/api';
import CardEle from '@/components/Elements/CardEle.vue';
import { getTimeText } from '@/utils/tools';
import { historyCard } from '@/utils/history';

export default {
  name: 'HistoryList',
  components: { CardEle },
  data: () => ({ cards: [], loading: false, error: '' }),
  mounted() { this.update(); },
  methods: {
    seeMore() { chrome.tabs.create({ url: 'https://www.bilibili.com/account/history' }); },
    async update() {
      if (this.loading) return;
      this.loading = true;
      this.error = '';
      try {
        const response = await getHistoryData();
        if (response?.code !== 0 || !Array.isArray(response.data?.list)) throw new Error('history request failed');
        this.cards = response.data.list.map(item => historyCard(item,
          item.view_at ? getTimeText(item.view_at) : '')).filter(Boolean);
      } catch (error) {
        this.error = '加载失败，请重试';
      } finally { this.loading = false; }
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
</style>
