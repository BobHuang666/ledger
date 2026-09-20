import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import SearchPage from './components/SearchPage';
import StatsPage from './components/StatsPage';

// 可视化页依赖 echarts，体积较大，按需加载以减小首屏体积
const VisualizationPage = lazy(() => import('./components/VisualizationPage'));

const App = () => {
  return (
    <Router>
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">
            <span className="app-title-seal" aria-hidden="true">善</span>
            <span className="app-title-lines">
              <span className="app-title-line">汕头存心善堂二十世纪</span>
              <span className="app-title-line">四十年代收客记录系统</span>
            </span>
          </h1>
          <nav className="nav-bar">
            <NavLink
              to="/search"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              搜索
            </NavLink>
            <NavLink
              to="/stats"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              统计
            </NavLink>
            <NavLink
              to="/visualization"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              可视化
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="app-shell">
        <main>
          <Routes>
            <Route path="/search" element={<SearchPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route
              path="/visualization"
              element={
                <Suspense
                  fallback={
                    <div className="page-container">
                      <div className="card soft" style={{ textAlign: 'center', padding: '48px' }}>
                        <p className="page-description">加载中...</p>
                      </div>
                    </div>
                  }
                >
                  <VisualizationPage />
                </Suspense>
              }
            />
            <Route
              path="/"
              element={
                <div className="card soft" style={{ marginTop: '48px', textAlign: 'center', padding: '48px 32px' }}>
                  <h2 className="page-heading">欢迎使用汕头存心善堂<br />二十世纪四十年代收客记录系统</h2>
                  <p className="page-description">
                    在这里您可以快速搜索收客记录，并通过统计洞察了解关键数据分布。
                  </p>
                  <div style={{ display: 'inline-flex', gap: 12 }}>
                    <NavLink to="/search" className="btn btn-primary">
                      前往搜索
                    </NavLink>
                    <NavLink to="/stats" className="btn">
                      查看统计
                    </NavLink>
                    <NavLink to="/visualization" className="btn">
                      数据可视化
                    </NavLink>
                  </div>
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
