module.exports = {
  server: {
    port: 8000,
  },
  empShare: {
    name: 'remote',
    exposes: {
      './App': './src/App.js' // 对外暴露的组件
    }
  }
}