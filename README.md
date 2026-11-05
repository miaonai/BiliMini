## BiliMini

![logo](preview/logo.png)

Bilibili辅助扩展，用于提示并快速查看更新。

### 安装

**GitHub 发行版（Chrome / Edge）**

从 [Releases](https://github.com/miaonai/BiliMini/releases/latest) 下载 ZIP，解压后在扩展管理页开启开发者模式，选择“加载已解压的扩展”。也提供 CRX3 签名包，其安装受浏览器策略限制。GitHub 版使用独立扩展 ID，与以下商店版本分别安装。

**从浏览器扩展商店下载**

[![Firefox](https://img.shields.io/amo/v/bilimini.svg?label=Mozilla%20Firefox)](https://addons.mozilla.org/zh-CN/firefox/addon/bilimini/)

[![Chrome](https://img.shields.io/chrome-web-store/v/fcibfbohheekhmgachjjghbhligddmcl)](https://chrome.google.com/webstore/detail/bilimini/fcibfbohheekhmgachjjghbhligddmcl?hl=zh-CN&authuser=0)

[![Edge](https://img.shields.io/badge/dynamic/json?label=Edge%20Addons&prefix=v&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2FAddons%2Fgetproductdetailsbycrxid%2Fbpfhljkccknkkngaoklgcabllbpdfaie)](https://microsoftedge.microsoft.com/addons/detail/bilimini/bpfhljkccknkkngaoklgcabllbpdfaie)

### 功能

- 角标数字提醒
- Popup展开查看
- 支持普通投稿、番剧、直播、历史记录、综合热门
- 支持添加和取消稍后再看
- 支持Tab切换、滚动加载
- Tab更新提示
- 快捷键操作（Alt+B / Option+B弹出，数字键按当前显示栏目的顺序切换）
- 设置：独立显示或隐藏番剧、直播、历史、热门栏目
- 拖动栏目名称前的三横条调整顺序，自动保存；隐藏的栏目不占用快捷键
- 可分别关闭投稿页和直播页的红点提示
- 热门页沿用投稿页卡片布局，支持滚动加载和稍后再看
- 可隐藏投稿中的充电专属视频
- 可关闭卡片左上角的稍后再看按钮
- 卡片悬停发光边框默认开启，可在设置中关闭，跟随明暗主题
- 悬停卡片时仅放大原始封面，预览画面保持原尺寸；默认开启，可独立关闭封面放大效果
- 悬浮预览默认关闭，开启后可预览视频快照；支持自定义延迟（默认 800ms，可设为 0–5000ms）、自动轮播或跟随鼠标位置，自动更新间隔默认 700ms，可调整为 100–2000ms
- 预览画面显示时隐藏封面上的统计、时长、发布时间、推荐原因及历史观看进度，退出预览后恢复
- 封面左下角显示播放量、弹幕数，右下角显示时长
- 可调整宽度
- 自适应或手动 1–4 列，卡片字号随布局调整
- 顶栏下方使用独立滚动区域，可隐藏滚动条
- 历史页使用视频卡片，显示观看进度条、已看时长及“已看完”状态

### 预览

**截图版本较古早,以实际安装为准**

![small](preview/small.png)
![medium-1](preview/medium-1.png)
![medium-2](preview/medium-2.png)
![medium-3](preview/medium-3.png)

### 自行构建

**Node.js 22 以上**

安装依赖:

    npm ci

调试:

    npm run build-watch

构建:

    npm run build

检查:

    npm run lint -- --no-fix
    npm test

浏览器检查需先安装 Chromium，本机需有 Edge：

    npx playwright install chromium
    npm run build
    npm run test:ui
    npm run test:extension

设置环境变量 `TEST_BROWSERS=chromium` 可只运行 Chromium 交互检查。浏览器测试使用模拟数据和临时配置，不访问个人账号。

可使用环境变量切换至firefox版本的的 `manifest.json`:

    export NODE_PLATFORM=firefox

### 发布 GitHub 发行版

同步修改 `package.json`、`package-lock.json` 和两个 manifest 的版本号，补充 `docs/releases/v版本号.md`，并运行 `npm run release:check`。提交后推送对应的 `v版本号` 标签，`Release extension` 工作流会测试、构建并发布 CRX、ZIP 和校验文件。失败的流程可重跑，或从 Actions 手动选择已有标签；已发布资产不会被覆盖。

CRX 使用仓库 Secret `CRX_PRIVATE_KEY` 签名，Chrome manifest 中的 `key` 是对应公钥。后续版本应保留同一密钥对，以保持扩展 ID。私钥不应提交到仓库或上传为发行资产。

### 更新

**2026-11-05：版本 2.4.2（GitHub 发行版，Chrome / Edge）**

- 悬停放大效果仅作用于原始封面，预览画面保持正常尺寸

**2026-11-05：版本 2.4.1（GitHub 发行版，Chrome / Edge）**

- 新增卡片悬停发光边框和封面微缩效果，默认开启，可分别关闭
- 新增悬浮快照预览，默认关闭，支持自动轮播或跟随鼠标位置
- 预览延迟默认 800ms，可设为 0–5000ms；自动更新间隔默认 700ms，可设为 100–2000ms
- 预览期间隐藏封面上的统计、时长、发布时间、推荐原因及历史观看进度，退出后恢复
- 预览使用对应分 P 的快照和时长，无快照时保留封面
- 修复隐藏的充电专属视频仍触发未读角标和投稿更新提示的问题

**2026-11-03：版本 2.4.0（Edge / Chrome）**

- 设置支持拖动排列栏目，数字快捷键跟随已显示栏目的顺序
- 新增综合热门页，以及投稿页、直播页独立的红点提示开关
- 新增设置，可隐藏栏目、充电专属视频和稍后再看按钮
- 支持调整宽度、自适应或手动 1–4 列、隐藏滚动条
- 视频卡片显示播放量、弹幕数和时长；历史卡片显示观看进度
- 修复切换页面时顶栏晃动、筛选后翻页和快速切换栏目时的数据混入
- 更新依赖，补充逻辑和浏览器测试
- GitHub Actions 自动构建、验证并发布 CRX、ZIP 和 SHA-256 校验文件

**2026-07-30: 版本2.3.11（仅Chrome商店）**

- 修复Vivaldi浏览器上显示异常和不能滚动加载的问题 [#16](https://github.com/Taosky/BiliMini/issues/16)

**2024-07-31: 版本2.3.9**

- 修复了B站页面“稍后在看”失效问题，关闭弹出页后可能需等待数秒 ([#14](https://github.com/Taosky/BiliMini/issues/14))

**2023-10-26: 版本2.3.8**

- 一些界面优化和问题修复

**2023-09-18: 版本2.3.7**

- 修复稍后再看导致的投稿页空白问题

**2023-09-17: 版本2.3.6**

- 代码优化
- 尝试修复一些问题
- 联合投稿显示

**2023-09-02: 版本2.3.0**

- 修复番剧页失效问题 [#9](https://github.com/Taosky/BiliMini/issues/9)
- 新增稍后再看按钮 [#8](https://github.com/Taosky/BiliMini/issues/8)
- 合并Firefox和Chrome代码 (Manifest V3)
- 一些其他优化

**2023-04-21: 版本2.2.5**

- 修复动态链接失效问题
- 修复番剧列表为空时卡死的问题 [#7](https://github.com/Taosky/BiliMini/issues/7)
- 修复Firefox重复打开登录页面的问题

**2023-04-15: 版本2.2.3**

- 优化使用体验

**2023-04-05: 版本2.2.1**

- 修复历史记录中番剧链接不正确问题

**2023-01-30: 版本2.2.0**

- 修复了一些问题
- 页面逻辑优化（减少重复请求）
- 新增历史记录查看
- 新增按键切换标签（数字1, 2, 3, 4）

**2022-12-24: 版本2.1.3**

- 增加快捷键快速显示窗口 Alt+B / Option+B

**2022-08-27: 版本2.1.2**

- 修复直播页滚动等问题

**2022-08-12: 版本2.1.1**

- 优化样式
- 修复直播卡片链接
- 修复Chromium下的一些问题

**2022-07-31: 版本2.1.0**

- 自适应浏览器暗黑模式
- 增加tab的badge显示，方便查看更新
- 修复Chromium下的异步存储问题

**2022-07-19: 版本2.0.0**

- 因Mozilla Addon审核问题更换vue-cli 模板[vue-cli-plugin-chrome-extension-cli](https://github.com/sanyu1225/vue-cli-plugin-chrome-extension-cli)
- Popup页面新增Tab，分别显示投稿、番剧、直播信息
- 支持滚动加载历史动态
- 优化UI显示

**2022-07-11: 版本1.8.6**

- 修复build结果不一致问题（无法上架问题）

**2022-07-11: 版本1.8.4**

- 代码优化
- 修复番剧显示

**2022-07-10: 版本1.8.3**

- 重新上架被下架版本（使用[vue-web-extension](https://github.com/Kocal/vue-web-extension)构建）
- `<del>`下个版本将新增功能 `</del>`

**2021-05-01: 版本1.8.1**

- 优化卡片样式

**2021-04-03: 版本1.8.1**

- 修复角标数字不消除的Bug

**2021-04-03: 版本1.8**

- 优化样式
- 增加更新时间显示

**2021.03.27: 版本1.7**

- 修复弹出窗口空白的问题，页面更新（参考脚本Bilibili Evolved）

**2019.12.21：版本1.6**

- CSS优化样式，隐藏滚动条等
