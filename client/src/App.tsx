import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { NurseDashboard } from './pages/NurseDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { SystemAdminDashboard } from './pages/SystemAdminDashboard';
import { HistoryPage } from './pages/HistoryPage';
import { AuditPage } from './pages/AuditPage';
import { WaitTimesScreen } from './pages/WaitTimesScreen';
import { CircularProgress, Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

const ProtectedRoute = ({ children, roles }: { children: JSX.Element, roles?: string[] }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  
  if (!user) return <Navigate to="/login" />;
  
  if (roles && !roles.includes(user.role) && user.role !== 'ADMIN') {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>{t('app.accessDenied')}</Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>{t('app.profileLabel')}: <strong>{t(`roles.${user.role}`) || user.role}</strong></Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {t('app.requiresLabel')}: <strong>{roles.map((role) => t(`roles.${role}`) || role).join(' / ')}</strong>
        </Typography>
        <Button variant="contained" href="/login">{t('app.backToLogin')}</Button>
      </Box>
    );
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/wait-times"
              element={
                <ProtectedRoute roles={['TEMPOS_ESPERA']}>
                  <WaitTimesScreen />
                </ProtectedRoute>
              }
            />
            
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/login" />} />
              
              <Route 
                path="admin-dashboard" 
                element={
                  <ProtectedRoute roles={['ADMINISTRATIVO']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="nurse-dashboard" 
                element={
                  <ProtectedRoute roles={['ENFERMEIRO']}>
                    <NurseDashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="doctor-dashboard" 
                element={
                  <ProtectedRoute roles={['MEDICO']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="admin-system-dashboard" 
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <SystemAdminDashboard />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="history" 
                element={
                  <ProtectedRoute roles={['ADMIN', 'MEDICO', 'ADMINISTRATIVO', 'ENFERMEIRO']}>
                    <HistoryPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="audit" 
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <AuditPage />
                  </ProtectedRoute>
                } 
              />
            </Route>
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
