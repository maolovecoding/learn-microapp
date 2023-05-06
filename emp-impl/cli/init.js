const axios = require('axios')
const { createSpinner } = require('nanospinner') // 下载的动画效果
const git = require('git-promise') // 下载仓库
const fs = require('fs-extra')
const path = require('path')
class Init{
  templates = {}
  async setup(options){
    if (typeof options.template === 'string') {
      // json 链接
      const templates = await this.checkTemplate(options.template)
      if (templates){
        this.templates = templates
      }
      await this.selectTemplate(this.templates)
    }
  }
  // json的url地址 htpp://xxx.jspn
  async checkTemplate(jsonUrl){
    const { data } = await axios.get(jsonUrl)
    return data
  }
  async selectTemplate(templates){
    console.log(templates)
    const inquirer = await (await import('inquirer')).default
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '请输入项目名',
        default: () => {
          return 'mao-project-demo'
        }
      },{
        type: 'list',
        name: 'template',
        message: "请选择模板",
        choices:Object.keys(templates)
      }
    ])
    const gitRepo = this.templates[answers.template]
    await this.downloadReop(gitRepo, answers.name)
  }
  async downloadReop(repoPath, localPath){
    const spinner= createSpinner()
    spinner.start({ text: 'downloading\n' })
    await git(`clone ${repoPath} ./${localPath}`)
    spinner.success({
      text: `\n cd ${localPath}\n npm install\n npm run dev`
    })
  }
}
module.exports = new Init