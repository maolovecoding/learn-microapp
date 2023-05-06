/**
 * @Author: 毛毛 
 * @Date: 2023-04-19 16:31:52 
 * @Last Modified by: 毛毛
 * @Last Modified time: 2023-04-19 20:20:39
 * @description 应用加载状态
 */

import { apps } from "./app.js"

// 加载
export const NOT_LOADED = Symbol('not_loaded') // 未加载
export const LOADING_SOURCE_CODE = Symbol('loading_source_code') // 加载资源
export const LOADING_ERROR = Symbol('loading_error') // 加载资源失败
// 启动的过程
export const NOT_BOOTSTRAPED = Symbol('not_bootstraped') // 资源加载完毕 需要启动 但是还没启动
export const BOOTSTRAPING = Symbol('bootstrapped') // 启动中
export const NOT_MOUNTED = Symbol('not_mounted') // 没有被挂载
// 挂载流程
export const MOUNTING = Symbol('mounting') // 正在挂载
export const MOUNTED = Symbol('mounted') // 挂载完成
// 卸载流程
export const UNMOUNTING = Symbol('unmounting') // 卸载中

// 应用是否正在被激活
export function isActive(app){
  return app.status === MOUNTED // 此应用正在被激活
}

// 此应用是否被激活
export function shouldBeActive(app) {
  return app.activeWhen(window.location)
}
/**
 * app对应的状态
 * @returns 
 */
export function getAppChanges(){
  const appsToLoad = [],
  appsToMount = [],
  appsToUnmount = [];
  apps.forEach(app => {
    const appShouldBeActive = shouldBeActive(app)
    switch (app.status) {
      case NOT_LOADED:
      case LOADING_SOURCE_CODE:
        if(appShouldBeActive) appsToLoad.push(app) // 需要被加载的应用
        break
      case NOT_BOOTSTRAPED:
      case BOOTSTRAPING:
      case NOT_MOUNTED:
        if (appShouldBeActive) appsToMount.push(app) //需要挂载的应用
        break
      case MOUNTED:
        if (!appShouldBeActive) appsToUnmount.push(app) // 需要卸载
      default:
        break
    }
  })
  return {
    appsToLoad, appsToMount, appsToUnmount
  }
}