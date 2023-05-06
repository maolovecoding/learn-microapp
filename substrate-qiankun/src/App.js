import { useEffect, useRef } from 'react';
import { Link, BrowserRouter } from 'react-router-dom'
import { loadMicroApp } from 'qiankun'
function App() {
  const containerRef = useRef()
  useEffect(()=>{
    loadMicroApp({
      name: 'staticDemo',
      entry:'//localhost:30000',
      container: containerRef.current,
    })
  })
  return (
    <div className="App">
      <BrowserRouter>
        <ul>
          <li><Link to="/react">react子应用</Link></li>
          <li><Link to="/vue">vue子应用</Link></li>
        </ul>
      </BrowserRouter>
      <div ref={containerRef}></div>
      <div id="container"></div>
    </div>
  );
}

export default App;
