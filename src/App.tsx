import './index.css';
import { useApp } from './context/AppContext';
import TopNav from './components/TopNav';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Home from './pages/Home';
import HotTopics from './pages/HotTopics';
import Virality from './pages/Virality';
import Comments from './pages/Comments';
import Radar from './pages/Radar';

function PanelSwitch() {
  const { activeTool } = useApp();
  return (
    <div className="content">
      <div className={`tool-panel${activeTool === 'home' ? ' active' : ''}`}><Home /></div>
      <div className={`tool-panel${activeTool === 'hot' ? ' active' : ''}`}><HotTopics /></div>
      <div className={`tool-panel${activeTool === 'virality' ? ' active' : ''}`}><Virality /></div>
      <div className={`tool-panel${activeTool === 'comment' ? ' active' : ''}`}><Comments /></div>
      <div className={`tool-panel${activeTool === 'radar' ? ' active' : ''}`}><Radar /></div>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ minHeight: 600 }}>
      <TopNav />
      <div className="main-wrap">
        <Sidebar />
        <PanelSwitch />
      </div>
      <Toast />
    </div>
  );
}
