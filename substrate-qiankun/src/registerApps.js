import { registerMicroApps, start } from 'qiankun'

const loader = loading => {
  console.log('拿到加载状态：', loading)
}

registerMicroApps([
  {
    name: 'react-demo-app', // 和子应用umd暴露的名字相同
    entry: '//localhost:10000', // react 子应用启动的入口 10000端口
    activeRule: '/react', // 当路径是 /react的时候启动
    container: '#container', // 应用挂载的位置
    loader,
    props: {
      isReactDemo: true // 传参  eventBus vuex redux ?
    }
  },
  {
    name: 'vue-demo-app', 
    entry: '//localhost:20000', 
    activeRule: '/vue', 
    container: '#container', 
    loader,
    props: {
      isVueDemo: true 
    }
  }
], {
  beforeLoad(){
    console.log('before load')
  },
  beforeMount(){
    console.log('before mount')
  },
  beforeUnmount(){
    console.log('before unmount')
  },
  afterMount(){
    console.log('after mount')
  },
  afterUnmount(){
    console.log('after unmount')
  }
})

start({
  sandbox: {
    // 样式隔离方案：
    // css-module，scoped：打包的时候生成一个选择器名字 增加属性来进行隔离
    // bem规范
    // css in js
    // shadow DOM 严格的隔离
    // experimentalStyleIsolation: true, // 实现动态样式表 css-module
    // 缺点： 子应用中的dom元素 如果挂载到了外层，会导致样式不生效

    // 影子dom隔离方案
    strictStyleIsolation: true, // 严格隔离
  }
})