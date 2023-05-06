# microapp

react和vue脚手架，使用的版本是5.x

## systemjs

### 主应用基本形态

这里是以一个html页面展示。

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>

<body>
  <h3>主应用 当前页面是主应用基座</h3>
  <script type="systemjs-importmap">
    {
      "imports": {
        "react": "https://cdn.bootcdn.net/ajax/libs/react/18.2.0/umd/react.development.js",
        "react-dom": "https://cdn.bootcdn.net/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js"
      }
    }
  </script>
  <div id="root"></div>
  <script src="https://cdn.bootcdn.net/ajax/libs/systemjs/6.14.1/system.js"></script>
  <script>
    // 直接加载子应用 采用的是system规范
    System.import('./index.js')
  </script>
</body>
</html>
```

### systemjs的使用

```js
System.register([依赖数组], callback)
```

### systemjs规范

1. systemjs是如何定义的？先看打包后的结果

    ```js
    System.register([依赖数组], callback)
    ```

    callback回调会等待依赖加载完毕后调用。
    callback的返回值是一个对象：

    ```js
      callback = () => {
        return {
          setters: [fn,  function(module) {
        Object.keys(module).forEach(function(key) {
        __WEBPACK_EXTERNAL_MODULE_react_dom__[key] = module[key];
        });
      }],
          execute: function(){}
        }
      }
    ```

2. setters是一个函数数组，函数的执行会把我们加载到的依赖，比如我们这的react等库放到webpack打包后的一个对象上，给webpack使用

3. 调用执行逻辑，开始页面渲染

### Systemjs规范的原理

```js

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
```

## Single-spa

### 安装脚手架

```shell
npm i create-single-spa -g
```

### 使用

#### 创建single-spa基座

```shell
create-single-spa substrate
```

#### 注册子应用的方式

```js
// 注册应用
registerApplication({
  name: "@single-spa/welcome",
  app: () =>
    System.import<LifeCycles>(
      "https://unpkg.com/single-spa-welcome/dist/single-spa-welcome.js"
    ),
  activeWhen: (location) => location.pathname === "/" // 满足路径要求激活子应用
});
```

#### 父应用加载过程

1. 启动基座，开启服务器9000
2. 访问index.ejs => @mao/root-config => mao-root-config.js
3. 注册子应用
4. 匹配路径激活子应用

## sigle-spa源码

### 简单实现原理

参考文件夹 `single-spa-impl`

缺点：single-spa只能在匹配到路径的时候才去加载子应用

参考： [single-spa](https://github.com/singleSpa/singleSpa_code)

## qiankun

参考资料：

- [qiankun技术圆桌](https://www.yuque.com/kuitos/gky7yw/mhfzh7)

1. 目前最稳定的微前端方案
2. 样式隔离，js沙箱，预加载

### qiankun使用

参考官网和文件夹：qiankun-static,qiankun-react-demo,qiankun-vue-demo,主应用substrate-qiankun

## 下一代微前端构建方案

### EMP

- [emp2](https://emp2.netlify.app/)是一个用于构建企业级微前端应用的框架。它允许您将大型前端应用程序分解为独立的、可独立开发、部署和维护的模块。这种模块化方法提高了可维护性和可扩展性，同时降低了开发复杂性

**emp做了什么？**： 其实emp就是帮我们配置了webpack的config，配了模块联邦

### Module Federation

#### 动机

- Module Federation的动机是为了不同开发小组间共同开发一个或者多个应用
- 应用将被划分为更小的应用块，一个应用块，可以是比如头部导航或者侧边栏的前端组件，也可以是数据获取逻辑的逻辑组件
- 每个应用块由不同的组开发
- 应用或应用块共享其他其他应用块或者库

#### 概念

- 使用Module Federation时，每个应用块都是一个独立的构建，这些构建都将编译为容器
- 容器可以被其他应用或者其他容器应用
- 一个被引用的容器被称为remote, 引用者被称为host，remote暴露模块给host, host则可以使用这些暴露的模块，这些模块被成为remote模块
