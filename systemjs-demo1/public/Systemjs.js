
// TODO 需要是无痕浏览条件 且只能首次加载才能成功，如果刷新页面 就加载失败了
// 直接加载子应用 采用的是system规范

// 这个地方是自己实现systemjs规范
const newMapUrl = {}
// 解析importMap
function processScripts() {
  Array.from(document.querySelectorAll('script')).forEach(script => {
    if (script.type === 'systemjs-importmap') {
      const imports = JSON.parse(script.innerHTML).imports
      Object.entries(imports).forEach(([key, val]) => {
        newMapUrl[key] = val
      })
    }
  })
}
function load(id) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = newMapUrl[id] || id // importsMap cdn配置查找
    script.async = true
    document.head.appendChild(script)
    script.onload = function (e) {
      // 备份
      let _lastRegister = lastRegister
      lastRegister = undefined
      resolve(_lastRegister) // 此时会执行index.js脚本
    }
  })
}

let lastRegister // 记录注册结果

class SystemJs {
  import(id) { // id 可以是第三方cdn地址 这里没考虑
    // 1. 去当前逻辑查找对应的资源
    return Promise.resolve(processScripts()).then(() => {
      // console.log(newMapUrl)
      // 去当前路径查找对应资源 index.js
      const lastSepIndex = location.href.lastIndexOf('/')
      const baseUrl = location.href.slice(0, lastSepIndex + 1)
      if (id.startsWith('./')) { // ./index.js
        return baseUrl + id.slice(2)
      }
    }).then(id => {
      let execute
      // 根据文件路径加载脚本资源
      // console.log(id) // index.html:51 http://127.0.0.1:5500/systemjs-demo1/dist/index.js
      return load(id).then(([deps, declare]) => {
        // console.log(deps, declare)
        // 调用register函数当时的回调 也就是declare
        // 第一个参数是一个函数 第二个参数是上下文对象
        // 返回值的execute是真正的执行逻辑
        // setters保存加载后的资源
        const { setters, execute: exe } = declare(() => { }, {})
        execute = exe
        // console.log(setters, execute)
        // console.log('所有文件加载完毕')
        return [deps, setters]
      }).then(([registeration, setters]) => {
        console.log(registeration, setters)
        debugger
        return Promise.all(registeration.map((dep, i) => { // dep => react react-dom
          // setters[i] // 拿到的是函数 加载资源 将加载后的脚本传递给setter
          return load(dep).then(() => {
            // dep加载完毕后 因为是umd格式 会在window上挂上 window.React window.ReactDOM
            // 我们要做的 就是拿到执行当前回调时，window上最后添加的属性 就是这个模块挂上去的
            // 将模块放到 setter
            const newProperty = getLastGlobalProperty()
            setters[i](newProperty) // 把资源交给webpack了
          })
        }))
      }).then(() => {
        execute()
      })
    })
  }
  register(deps, declare) {
    // console.log(deps, declare)
    lastRegister = [deps, declare]
  }
}
window.SystemJs = SystemJs
window.System = new SystemJs()


// 记录快照 window上有哪些属性
let set = new Set()
function saveGlobalProperty() {
  for (const key in window) {
    set.add(key)
  }
}
saveGlobalProperty() // window属性快照
// 获取window最后新增的属性  使用的形式为： 快照
function getLastGlobalProperty(index) {
  for (const key in window) {
    if (set.has(key)) continue
    set.add(key)
    return window[key] // 找到最后新增的key了
  }
}
