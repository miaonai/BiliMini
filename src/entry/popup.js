import Vue from 'vue'
import App from '../view/popup.vue'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import { SETTINGS_KEY, normalizeSettings, applyPopupSize } from '@/utils/settings';

Vue.config.productionTip = false
Vue.use(ElementUI);

async function start() {
  let saved;
  let settingsError = '';
  try {
    saved = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  } catch (error) {
    settingsError = '无法读取设置，当前使用默认值';
  }
  const settings = normalizeSettings(saved);
  applyPopupSize(settings);
  new Vue({
    render: (h) => h(App, { props: { initialSettings: settings, settingsError } })
  }).$mount('#app');
}
start();
