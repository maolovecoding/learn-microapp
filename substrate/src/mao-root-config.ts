import { registerApplication, start, LifeCycles } from "single-spa";

// 注册应用
registerApplication({
  name: "@single-spa/welcome",
  app: () =>
    System.import<LifeCycles>(
      "https://unpkg.com/single-spa-welcome/dist/single-spa-welcome.js"
    ),
  activeWhen: (location) => location.pathname === "/" // 满足路径要求激活子应用
});

registerApplication({
  name: "@mao/single-react-demo",
  app: () => System.import<LifeCycles>("@mao/single-react-demo"),
  activeWhen: ["/react"]
});
registerApplication({
  name: "@mao/single-vue-demo",
  app: () => System.import<LifeCycles>("@mao/single-vue-demo"),
  activeWhen: ["/vue"]
});

start({
  urlRerouteOnly: true
});
