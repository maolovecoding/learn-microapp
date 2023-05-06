import { LOADING_SOURCE_CODE, NOT_BOOTSTRAPED, NOT_LOADED } from "../application/app.helpers.js";

/**
 * 接入的协议如果是数组 拍平为一个promise函数
 */
function flattenArrayToPromise(fns) {
  fns = Array.isArray(fns) ? fns : [fns]
  if(fns.length === 0) fns = [() => Promise.resolve()]
  return function(props){
    return fns.reduce((rpromise, fn) => 
    rpromise.then(() => fn(props)), Promise.resolve())
  }
}

export function toLoadPromise(app){
  return Promise.resolve().then(() => {
    if (app.status !== NOT_LOADED) {
      // 此应用加载完毕了
      return app
    }
    app.status = LOADING_SOURCE_CODE // 正在加载应用
    return app.loadApp(app.customProps).then(v => {
      const { bootstrap, mount, unmount } = v // v就是实际的子应用
      app.status = NOT_BOOTSTRAPED
      // 记录暴露的协议
      app.bootstrap = flattenArrayToPromise(bootstrap)
      app.mount = flattenArrayToPromise(mount)
      app.unmount = flattenArrayToPromise(unmount)
      return app
    })
  })
}

// 当路由切换的时候 我们触发 single-spa的 addEventListener 应用中可能也包含其他的 addEventListener