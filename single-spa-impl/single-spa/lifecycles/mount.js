import { MOUNTED, NOT_MOUNTED } from "../application/app.helpers.js"

/**
 * 
 * @param {*} app 
 * @returns {Promise}
 */
export function toMountPromise(app){
  return Promise.resolve().then(() => {
    if (app.status !== NOT_MOUNTED) { 
      return app
    }
    return app.mount(app.customProps).then(() => {
      app.status = MOUNTED // 挂载完成
      return app
    })
  })
}