export default function Page1(){
  return <div>
    <h2>react项目</h2>
    {/* 标签是web-component实现的 */}
    <micro-app name="app1" 
    url="http://localhost:10000/"
    baseroute="/react"
    ></micro-app>
    </div>
}