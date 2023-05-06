
class MaoScript{
  async exec(name, options){
    console.log(name, options,'---exec')
    await require(`./${name}`).setup(options)
  }
}

module.exports = new MaoScript