const p = [
  async () => {
    await new Promise(resolve => {
      setTimeout(() => {
        console.log('app2 mount1')
        resolve()
      }, 2000);
    })
  },
  async () => {
    await new Promise(resolve => {
      setTimeout(() => {
        console.log('app2 mount2')
        resolve()
      }, 1000);
    })
  },
]

const compose = function(fns){
  return function(){
    return fns.reduce((p, fn) => p.then(() => fn()),Promise.resolve())
  }
}
compose(p)()

