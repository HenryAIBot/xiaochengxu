export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/select-product/index",
    "pages/result/index",
    "pages/monitor/index",
    "pages/report/index",
    "pages/messages/index",
    "pages/profile/index",
    "pages/admin-dlq/index",
    "pages/admin-data-sources/index",
  ],
  tabBar: {
    list: [
      { pagePath: "pages/home/index", text: "首页" },
      { pagePath: "pages/monitor/index", text: "监控" },
      { pagePath: "pages/report/index", text: "报告" },
      { pagePath: "pages/messages/index", text: "消息" },
      { pagePath: "pages/profile/index", text: "我的" },
    ],
  },
});
