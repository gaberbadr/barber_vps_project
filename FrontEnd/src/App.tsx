import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBookings from './pages/admin/AdminBookings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminBarbers from './pages/admin/AdminBarbers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminServices from './pages/admin/AdminServices';

// Spector Imports
import SpectorLayout from './layouts/SpectorLayout';
import SpectorDashboard from './pages/spector/SpectorDashboard';

// Public & Barber Imports
import PublicLayout from './layouts/PublicLayout';
import BarberDirectory from './pages/public/BarberDirectory';
import BarberProfile from './pages/public/BarberProfile';
import BarberLayout from './layouts/BarberLayout';
import BarberDashboard from './pages/barber/BarberDashboard';
import BarberWorkingHours from './pages/barber/BarberWorkingHours';
import BarberSettings from './pages/barber/BarberSettings';

// Customer Imports
import CustomerLayout from './layouts/CustomerLayout';
import MyBookings from './pages/customer/MyBookings';
import BookingWizard from './pages/public/BookingWizard';

// Public Imports
import Home from './pages/public/Home';
import About from './pages/public/About';
import PrivacyPolicy from './pages/public/PrivacyPolicy';
import TermsOfUse from './pages/public/TermsOfUse';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { isAuthenticated, userRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (allowedRoles && (!userRole || !allowedRoles.map(r => r.toLowerCase()).includes(userRole.toLowerCase()))) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Redirect based on role instead of placeholder
function DashboardRouter() {
  const { userRole } = useAuth();
  
  if (userRole?.toLowerCase() === 'admin') return <Navigate to="/admin" replace />;
  if (userRole?.toLowerCase() === 'spector') return <Navigate to="/spector" replace />;
  if (userRole?.toLowerCase() === 'barber') return <Navigate to="/barber" replace />;
  
  // Default for customer
  return <Navigate to="/bookings" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth"  element={<AuthPage />} />
      <Route path="/callback" element={<AuthCallbackPage />} />
      <Route path="/dashboard" element={<DashboardRouter />} />

      {/* Authenticated Customer Routes */}
      <Route 
        path="/bookings" 
        element={
          <ProtectedRoute>
            <CustomerLayout />
          </ProtectedRoute>
        } 
      >
        <Route index element={<MyBookings />} />
        {/* We can add /bookings/:id here if we make a detail view later */}
      </Route>
      
      {/* Public Routes with Public Layout */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/barbers" element={<BarberDirectory />} />
        <Route path="/barbers/:id" element={<BarberProfile />} />
        <Route path="/barbers/:id/book" element={<BookingWizard />} />
      </Route>

      {/* Admin Routes */}
      <Route 
        path="/admin" 
        element={
          <RoleProtectedRoute allowedRoles={['Admin']}>
            <AdminLayout />
          </RoleProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="bookings" element={<RoleProtectedRoute allowedRoles={['Admin']}><AdminBookings /></RoleProtectedRoute>} />
        <Route path="users" element={<RoleProtectedRoute allowedRoles={['Admin']}><AdminUsers /></RoleProtectedRoute>} />
        <Route path="coupons" element={<RoleProtectedRoute allowedRoles={['Admin']}><AdminCoupons /></RoleProtectedRoute>} />
        <Route path="barbers" element={<RoleProtectedRoute allowedRoles={['Admin']}><AdminBarbers /></RoleProtectedRoute>} />
        <Route path="services" element={<RoleProtectedRoute allowedRoles={['Admin']}><AdminServices /></RoleProtectedRoute>} />
        <Route path="settings" element={<RoleProtectedRoute allowedRoles={['Admin']}><AdminSettings /></RoleProtectedRoute>} />
      </Route>

      {/* Spector Routes */}
      <Route 
        path="/spector" 
        element={
          <RoleProtectedRoute allowedRoles={['Spector']}>
            <SpectorLayout />
          </RoleProtectedRoute>
        }
      >
        <Route index element={<SpectorDashboard />} />
      </Route>

      {/* Barber Portal Routes */}
      <Route 
        path="/barber" 
        element={
          <RoleProtectedRoute allowedRoles={['Barber']}>
            <BarberLayout />
          </RoleProtectedRoute>
        }
      >
        <Route index element={<BarberDashboard />} />
        <Route path="working-hours" element={<BarberWorkingHours />} />
        <Route path="settings" element={<BarberSettings />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
