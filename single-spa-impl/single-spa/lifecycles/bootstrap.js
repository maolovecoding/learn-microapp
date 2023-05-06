import { BOOTSTRAPING, NOT_BOOTSTRAPED, NOT_MOUNTED } from "../application/app.helpers.js";

/**
 * 启动app
 * @param {*} app 
 */
export function toBootstrapPromise(app){
  return Promise.resolve().then(() => {
    if (app.status !== NOT_BOOTSTRAPED) { 
      return app
    }
    app.status = BOOTSTRAPING // 启动中
    return app.bootstrap(app.customProps).then(() => {
      app.status = NOT_MOUNTED // 还未挂载
      return app
    })
  })
}