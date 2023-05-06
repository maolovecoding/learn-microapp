import './public-path'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let root
// react 子应用 暴露接入协议
function render(props){
  root = ReactDOM.createRoot(props.container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
// qiankun提供了一些标识  用于标识当前应用是否在父应用中被引入过
if (!window.__POWERED_BY_QIANKUN__)
  render({container: document.getElementById('root')}) // 独立运行

// qiankun要求应用暴露的方式是umd格式 => 写配置文件更改打包方式

export async function bootstrap(props){
  console.log(props, 'bootstrap')
}
export async function mount(props){
  // 基座的容器 叫做container
  render(props) // 指定挂载的container
  console.log(props, 'mount')
}
export async function unmount(props){
  console.log(props, 'unmount')
  root.unmount()
}
