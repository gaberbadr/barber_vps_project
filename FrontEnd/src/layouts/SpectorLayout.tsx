import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SpectorLayout.css';
import Logo from '../components/Logo';

export default function SpectorLayout() {
  const { handleLogout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const onLogout = async () => {
    await handleLogout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="spector-layout">
        {/* Mobile Header for Hamburger */}
        <div className="mobile-header">
          <div className="mobile-logo">
            <Logo className="small" onClick={() => navigate('/spector')} />
            <span>المراقب</span>
          </div>
          <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
            ☰
          </button>
        </div>

        {/* Overlay for mobile when sidebar is open */}
        {isMobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

        <aside className={`spector-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="spector-sidebar-header">
            <Logo onClick={() => navigate('/spector')} />
            <span>بوابة المراقب</span>
          </div>
          
          <nav className="spector-nav">
            <NavLink 
              to="/spector" 
              end
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => isActive ? 'spector-nav-link active' : 'spector-nav-link'}
            >
              لوحة التحكم
            </NavLink>
            
            <div className="nav-divider" style={{ margin: '1rem 0', borderBottom: '1px solid rgba(169, 139, 98, 0.2)' }}></div>
            <NavLink 
              to="/" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="spector-nav-link public-link"
            >
              الموقع الرئيسي
            </NavLink>
          </nav>

          <button className="spector-logout-btn" onClick={onLogout}>
            تسجيل الخروج
          </button>
        </aside>

        <main className="spector-content">
          <div className="spector-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
  );
}

