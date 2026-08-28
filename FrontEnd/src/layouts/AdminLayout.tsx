import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';
import Logo from '../components/Logo';

export default function AdminLayout() {
  const { handleLogout, userRole } = useAuth();
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
    <div className="admin-layout">
        {/* Mobile Header for Hamburger */}
        <div className="mobile-header">
          <div className="mobile-logo">
            <Logo className="small" onClick={() => navigate('/admin')} />
            <span>الإدارة</span>
          </div>
          <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
            ☰
          </button>
        </div>

        {/* Overlay for mobile when sidebar is open */}
        {isMobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

        <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="admin-sidebar-header">
            <Logo onClick={() => navigate('/admin')} />
            <span>لوحة الإدارة</span>
          </div>
          
          <nav className="admin-nav">
            <NavLink 
              to="/admin" 
              end
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
            >
              لوحة التحكم
            </NavLink>
            
            {userRole?.toLowerCase() !== 'spector' && (
              <>
                <NavLink 
                  to="/admin/bookings" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
                >
                  الحجوزات
                </NavLink>
                <NavLink 
                  to="/admin/users" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
                >
                  المستخدمين
                </NavLink>
                <NavLink 
                  to="/admin/coupons" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
                >
                  الكوبونات
                </NavLink>
                <NavLink 
                  to="/admin/barbers" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
                >
                  الحلاقين
                </NavLink>
                <NavLink 
                  to="/admin/services" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
                >
                  الخدمات
                </NavLink>
                <NavLink 
                  to="/admin/settings" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
                >
                  الإعدادات
                </NavLink>
              </>
            )}

            <div className="nav-divider" style={{ margin: '1rem 0', borderBottom: '1px solid rgba(169, 139, 98, 0.2)' }}></div>
            <NavLink 
              to="/" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="admin-nav-link public-link"
            >
              الموقع الرئيسي ↗
            </NavLink>
          </nav>

          <button className="admin-logout-btn" onClick={onLogout}>
            تسجيل الخروج
          </button>
        </aside>

        <main className="admin-content">
          <div className="admin-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
  );
}

