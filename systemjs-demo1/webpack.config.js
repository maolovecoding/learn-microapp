const HTMLWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

module.exports = env => {
  return {
    mode: 'development',
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: env.production ? 'system' : '' // 生产模式下采用systemjs模块规范
    },
    module: {
      rules: [
        {
          test: /\.js|.jsx$/,
          use: { loader: 'babel-loader' },
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      !env.production && new HTMLWebpackPlugin({
        template: './public/index.html'
      })
    ].filter(Boolean), // 生产环境不生成html
    externals: env.production ? ['react', 'react-dom'] : [], // 生产环境去掉react
    resolve: {
      extensions: ['.js','.jsx','json']
    }
  }
}