const path = require('path')
const webpack = require('webpack')
const WebpackChain = require('webpack-chain')
module.exports.getConfig = () => {
  const Config = new WebpackChain()
  const empConfigPath = path.resolve(process.cwd(), "emp-config.js")
  const empConfig = require(empConfigPath)
  const afterConfig = processDefault(empConfig) // 配置默认值
  Config.merge(afterConfig)
  return Config.toConfig() // 转为webpack配置对象
}

function processDefault(empConfig){
  const devServer = empConfig.server || {}
  delete empConfig.server
  // 创建模块联邦的选项对象
  const mfOptions = {
    filename: 'emp.js', // 指定当前容器对外提供的模块联邦的服务 生成单独的文件 emp.js
    ...empConfig.empShare
  }
  delete empConfig.empShare // 不是标准配置 删除
  return {
    context: process.cwd(), // 项目根目录
    mode: 'development',
    devtool: false,
    devServer,
    plugin: { // 配置插件 这个都是webpack-chain的写法
      html: {
        plugin: require('html-webpack-plugin'), // 插件构造函数
        args: [
          {
            template: path.join(__dirname, '../template/index.html')
          }
        ]
      },
      mf: {
        // 模块联邦
        plugin: webpack.container.ModuleFederationPlugin,
        args: [mfOptions]
      }
    },
    module: {
      rule: {
        compile: {
          test: /\.js$/,
          exclude: [/node_modules/],
          use: {
            'babel-loader': {
              loader: require.resolve('babel-loader'),
              options: {
                presets: [
                  require.resolve('@babel/preset-env'),
                  require.resolve('@babel/preset-react'),
                ]
              }
            }
          }
        }
      }
    },
    ...empConfig,
  }
}