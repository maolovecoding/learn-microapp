import { MOUNTED, NOT_MOUNTED, UNMOUNTING } from "../application/app.helpers.js"


export function toUnmountPromise(app) {
  return Promise.resolve().then(() => {
    if (app.status !== MOUNTED) {
      return app // 没有挂载 不需要卸载
    }
    app.status = UNMOUNTING // 卸载中
    return app.unmount(app.customProps).then(() => {
      app.status = NOT_MOUNTED
      return app
    })
  })
}