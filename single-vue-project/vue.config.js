const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: 'http://localhost:4000',
  devServer: {
    port: 4000,
  },
  chainWebpack: config => {
    // 干掉这个插件才能支持 single-spa
    if (config.plugins.has('SystemJSPublicPathWebpackPlugin')) {
      config.plugins.delete('SystemJSPublicPathWebpackPlugin')
    }
  }
})
