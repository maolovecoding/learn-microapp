#!/usr/bin/env node
// 处理命令行参数
const program = require('commander')
const pkg = require('../package.json')
const cli = require('../cli')
// 设置脚手架版本号
program
.version(pkg.version, '-v,--version')
.usage('<command> [options]')

// 添加 init 命令，用于初始化项目
program.command('init')
    .description('初始化项目')
    .option('-t, --template [template]', 'JSON数据 http地址或者文件路径相对、绝对路径')
    .action(options => {
      cli.exec('init', options)
    })

program.command('dev')
.description('启动开发服务器')
// .option('-t, --template [template]', 'JSON数据 http地址或者文件路径相对、绝对路径')
.action(options => {
  cli.exec('dev', options)
})
program.parse(process.argv)