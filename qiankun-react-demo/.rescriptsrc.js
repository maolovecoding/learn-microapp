module.exports = {
  webpack: config => {
    config.output.libraryTarget = 'umd'
    config.output.library = 'reactDemoApp'
    return config
  },
  devServer: config => {
    // 支持跨域访问
    config.headers = {
      'Access-Control-Allow-Origin': '*'
    }
    return config
  }
}