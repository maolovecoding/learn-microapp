module.exports = {
  server: {
    port: 9000,
    // open: true
  },
  empShare: {
    name: 'host',
    remotes: { // 引用远程的容器
      '@remote': 'remote@http://localhost:8000/emp.js'
    }
  }
}