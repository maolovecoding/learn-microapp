import { reroute } from "./reroute.js"

/**
 * @Author: 毛毛 
 * @Date: 2023-04-19 21:45:18 
 * @Last Modified by: 毛毛
 * @Last Modified time: 2023-04-20 08:51:48
 * @description 对路径切换 进行劫持 劫持后重新调用 reroute方法 进行计算应用的加载
 */
// let beforUrl = window.location.href // 简单模拟屏蔽操作
function urlRoute(e){
  // let afterUrl = window.location.href
  // if (beforUrl === afterUrl) return
  // beforUrl = window.location.href
  reroute(e)
}
// TODO 这里绑定了两次 所以会触发两次函数，第一次是点击触发hashchange 第二次是因为点击修改了浏览器地址栏的历史记录，导致触发popstate
// 所以如果挂载是异步的，比如mount是1000后应用才加载完毕 会出现又触发一次mount函数的
// 这里的问题主要是因为我们点击的是链接 a 所以导致这种情况
// 可以搞一个更新队列来解决这个问题 屏蔽多次更新的操作 onChangeUnderWay
window.addEventListener('hashchange', urlRoute)
window.addEventListener('popstate', urlRoute)

// 路由切换时，我们触发single-spa的addeventlistener 应用中也可能包含其他的 addeventListener

// 需要劫持原生的路由系统，保证我们家长玩再切换路由
const captureedEventListeners = {
  hashchange: [],
  popstate: []
}
let listeningTo = ['hashchange', 'popstate']

const originalAddEventListener = window.addEventListener
// const originalRemoveAddEventListener = window.removeEventListener

window.addEventListener = function(eventName, callback){
  if (listeningTo.includes(eventName)) {
    // 有要监听的事件 函数不能重复
    captureedEventListeners[eventName] = captureedEventListeners[eventName].filter(fn => fn!==callback)
    captureedEventListeners[eventName].push(callback)
    return
  }
  return originalAddEventListener.apply(this, arguments)
}
/**
 * 调用捕获的事件
 * @param {Event} event
 */
export function callCaptureEventListeners(event){
  console.log(event)
  if (event) {
    const eventType = event.type
    if(listeningTo.includes(eventType)) {
      captureedEventListeners[eventType].forEach(listener => listener.call(this, event))
    }
  }
}
// 劫持
window.history.pushState = patchFn(window.history.pushState, 'pushState')
window.history.replaceState = patchFn(window.history.replaceState, 'replaceState')

/**
 * 
 * @param {*} updateState 更新方法
 * @param {*} methodName 方法名
 */
function patchFn(updateState, methodName){
  return function(){
    const urlBefore = window.location.href // 路径更新前
    const r = updateState.apply(this,arguments) // 执行更新路径的方法
    const urlAfter = window.location.href // 更新后
    if (urlAfter !== urlBefore) {
      // 路径确实发生改变
      window.dispatchEvent(new PopStateEvent('popstate')) // 手动触发popstate事件
    }
    return r
  }
}