import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import Page1 from './page-1';
import Page2 from './page-2';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ul>
          <li><Link to="/react">/react</Link></li>
          <li><Link to="/vue">/vue</Link></li>
        </ul>
        <Routes>
        <Route path="/react/*" element={<Page1/>}></Route>
        <Route path="/vue/*" element={<Page2/>}></Route>
      </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
