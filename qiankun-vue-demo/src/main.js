import './public-path'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import routes from './router'

let app, router, historys

function render(props){
  app = createApp(App)
  historys = createWebHistory(window.__POWERED_BY_QIANKUN__ ? '/vue' : '/')
  router = createRouter({
    history: historys,
    routes
  })
  console.log('---->>>>', window.__POWERED_BY_QIANKUN__ , historys)
  app.use(router)
  const container = props.container
  app.mount(container ? container: document.getElementById('app'))
}
if (!window.__POWERED_BY_QIANKUN__){
  render({})
}


export async function bootstrap(props){
  console.log('bootstrap vue', props)
}
export async function mount(props){
  console.log('mount vue', props)
  render(props)
}
export async function unmount(props){
  console.log('unmount vue', props)
  historys?.destroy?.()
  app?.unmount?.()
  app = null, router = null
}
