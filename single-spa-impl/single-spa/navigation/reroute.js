/**
 * @Author: 毛毛 
 * @Date: 2023-04-19 16:53:08 
 * @Last Modified by: 毛毛
 * @Last Modified time: 2023-04-20 08:58:09
 * @description 
 */

import { getAppChanges, shouldBeActive } from "../application/app.helpers.js";
import { toBootstrapPromise } from "../lifecycles/bootstrap.js";
import { toLoadPromise } from "../lifecycles/load.js";
import { toMountPromise } from "../lifecycles/mount.js";
import { toUnmountPromise } from "../lifecycles/unmount.js";
import { isStarted } from "../start.js";
import { callCaptureEventListeners } from "./navigation-event.js";

let appChangeUnderWay = false
let peopleWaitingOnAppChange = []
/**
 * 每次注册应用都会执行该函数 后续路径变化也会走该函数
 */
export function reroute(event){
  // 搞一个更新队列来解决这个问题 屏蔽多次更新的操作
  if (appChangeUnderWay) {
    return new Promise((resolve, reject) => {
      peopleWaitingOnAppChange.push({
        resolve,reject
      })
    })
  }
  const { appsToLoad, appsToMount, appsToUnmount } = getAppChanges()
  if (isStarted) {
    appChangeUnderWay = true
    // 用户调用了start方法 我们需要处理当前应用 要挂载或者卸载
    return performAppChange(appsToLoad, appsToMount, appsToUnmount, event)
  }
  // 加载完毕后 需要去挂载的应用
  return loadApps(appsToLoad, event)
}

function loadApps(appsToLoad, event){
  // 先拿到应用去加载
  return Promise.all(
    appsToLoad.map(
      toLoadPromise
      // app => toLoadPromise(app) // 目前还没有调用start
    )
  ).then(() => callEventListener(event))
}
/**
 * 卸载不需要的应用  加载需要的应用 => 启动 => 挂载
 */
function performAppChange(appsToLoad, appsToMount, appsToUnmount, event){
  // 卸载
  const unmountAllPromises = Promise.all(appsToUnmount.map(toUnmountPromise))
  // 加载需要的应用 可能这个应用在注册的时候已经被加载了
  // 默认情况注册的路径是 /a 但是让我们start的时候应用是 /b
  const loadMountPromises = Promise.all(
    appsToLoad.map(
      app => toLoadPromise(app)
      .then(app => {
        // 当应用加载完毕后 需要启动和挂载 但是要保证挂载前 先卸载掉原来的应用
        return tryBootstrapAndMount(app, unmountAllPromises) // 尝试启动和挂载
      })
    )
  )
  // 如果应用没有加载 那就是  加载 => 启动 => 挂载 
  // 发生应用切换时，可能应用已经是加载过的 那么就是 直接挂载
  const mountPromises = Promise.all(
    appsToMount.map(
      app => tryBootstrapAndMount(app, unmountAllPromises)
    )
  )
  return Promise.all([loadMountPromises, mountPromises]).then(()=>{ // 卸载完毕后 触发绑定的路由切换事件
    callEventListener(event)
    if(peopleWaitingOnAppChange.length) {
      // 用户的多次操作缓存起来了 后续可以使用
      peopleWaitingOnAppChange = []
    }
    appChangeUnderWay = false
  })
}
/**
 * 当应用加载完毕后 需要启动和挂载 但是要保证挂载前 先卸载掉原来的应用
 * @param {*} app 
 * @param {*} unmountAllPromises 
 */
function tryBootstrapAndMount(app, unmountAllPromises) {
  if (shouldBeActive(app)) {
    // 保证卸载完毕再挂载
    return toBootstrapPromise(app) // 启动app
      .then(
        app => unmountAllPromises // 确保所有子应用需要卸载的都卸载了
        .then(() => toMountPromise(app))
      )
  }
}

function callEventListener(event){
  callCaptureEventListeners(event)
}