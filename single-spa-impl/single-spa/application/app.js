import { reroute } from "../navigation/reroute.js"
import { NOT_LOADED } from "./app.helpers.js"
import '../navigation/navigation-event.js'

export const apps = []
/**
 * 所谓的注册应用 就是看路径是否匹配 匹配就加载对应的应用
 * @param {*} appName 应用名
 * @param {*} loadApp 如何加载app 这个函数返回值就是子应用对象
 * @param {*} activeWhen 匹配规则 应用何时激活
 * @param {*} customProps 自定义的数据
 */
export function registerApplication(appName, loadApp,activeWhen, customProps){
  const registeration = {
    name: appName,
    loadApp,
    activeWhen,
    customProps,
    status: NOT_LOADED
  }
  apps.push(registeration)
  // 给每个应用添加对应的状态变化
  // 未加载 => 加载 => 挂载 => 卸载
  // 需要检查那些应用需要被加载  那些应用需要被挂载 还有那些应用需要被移除
  reroute() // 重写路由
}