import { reroute } from "./navigation/reroute.js"

/**
 * 是否调用过start方法
 */
export let isStarted = false
/**
 * 开启路径的监控，路径切换的时候，可以调用对应的mount unmount
 */
export function start(){
  isStarted = true
  reroute()
}