const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");

module.exports = (webpackConfigEnv, argv) => {
  const defaultConfig = singleSpaDefaults({
    orgName: "mao",
    projectName: "single-react-demo",
    webpackConfigEnv,
    argv
  });
  // react react-dom就打包到当前项目中
  delete defaultConfig.externals;
  return merge(defaultConfig, {
    devServer: {
      port: 3000
    }
    // modify the webpack config however you'd like to by adding to this object
  });
};
