import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container, MenuItem, Select, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Badge } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from './ChatPanel';
import { useSnackbar } from 'notistack';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

export const Layout = () => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [chatOpen, setChatOpen] = React.useState(false);
  const [unreadByTarget, setUnreadByTarget] = React.useState<Record<string, number>>({});
  const [chatPulse, setChatPulse] = React.useState(false);
  const [activeChatTarget, setActiveChatTarget] = React.useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [clinicName, setClinicName] = React.useState('');
  const [clinicLogo, setClinicLogo] = React.useState('');
  const [showClinicLogo, setShowClinicLogo] = React.useState(true);
  const [showWalkflowLogo, setShowWalkflowLogo] = React.useState(true);
  const pulseTimerRef = React.useRef<number | null>(null);

  const getTargetKey = (msg: any) => {
    if (msg?.toUserId) return `USER:${msg.toUserId}`;
    if (msg?.toRole) return `ROLE:${msg.toRole}`;
    return 'ROLE:ALL';
  };

  React.useEffect(() => {
    if (!socket || !user) return;
    const handler = (msg: any) => {
      if (msg?.fromUserId === user.id) return;
      const targetKey = getTargetKey(msg);
      if (chatOpen && activeChatTarget && targetKey === activeChatTarget) {
        return;
      }
      setUnreadByTarget((prev) => ({
        ...prev,
        [targetKey]: (prev[targetKey] || 0) + 1,
      }));
      if (!chatOpen) {
        setChatPulse(true);
        if (pulseTimerRef.current) {
          window.clearTimeout(pulseTimerRef.current);
        }
        pulseTimerRef.current = window.setTimeout(() => setChatPulse(false), 3000);
      }
    };
    socket.on('chat_message', handler);
    return () => {
      socket.off('chat_message', handler);
    };
  }, [socket, user, chatOpen, activeChatTarget]);

  const totalUnread = Object.values(unreadByTarget).reduce((sum, value) => sum + value, 0);

  const handleReadTarget = (key: string) => {
    setUnreadByTarget((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    setChatPulse(false);
  };

  const handleUrgentAlert = () => {
    if (!socket || !user) return;
    socket.emit('urgent_alert', {
      fromUserId: user.id,
      fromUserName: user.fullName || user.username,
      message: 'ATENÇÃO IMEDIATA'
    });
    enqueueSnackbar(t('alerts.urgentSent'), { variant: 'warning' });
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('walkflow_lang', value);
  };

  const roleLabel = user ? (t(`roles.${user.role}`) || user.role) : '';

  const applySettings = React.useCallback((data: any) => {
    setClinicName(data?.clinicName || '');
    setClinicLogo(data?.clinicLogo || '');
    setShowClinicLogo(data?.showClinicLogo !== false);
    setShowWalkflowLogo(data?.showWalkflowLogo !== false);
  }, []);

  const isSettingsPayload = (data: any) => {
    if (!data || typeof data !== 'object') return false;
    return (
      'clinicName' in data ||
      'clinicLogo' in data ||
      'showClinicLogo' in data ||
      'showWalkflowLogo' in data
    );
  };

  const refreshSettings = React.useCallback(() => {
    axios.get('/api/settings/public')
      .then(({ data }) => applySettings(data))
      .catch(() => {});
  }, [applySettings]);

  React.useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  React.useEffect(() => {
    if (!socket) return;
    const handleSettings = (data: any) => {
      if (isSettingsPayload(data)) applySettings(data);
      else refreshSettings();
    };
    socket.on('settings_updated', handleSettings);
    return () => {
      socket.off('settings_updated', handleSettings);
    };
  }, [socket, applySettings, refreshSettings]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f9ff' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#eaf4ff', color: '#0b3d5c' }}>
        <Toolbar sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {showWalkflowLogo && (
              <img
                src="/logowf.png"
                alt="WalkFlow logo"
                style={{ height: 56 }}
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {showClinicLogo && clinicLogo && (
              <img
                src={clinicLogo}
                alt="Clinic logo"
                style={{ height: 48 }}
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {clinicName || t('app.subtitle')}
            </Typography>
          </Box>
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Select
                size="small"
                value={i18n.language}
                onChange={(event) => handleLanguageChange(event.target.value)}
                sx={{ bgcolor: '#ffffff', borderRadius: 2 }}
              >
                <MenuItem value="pt">{t('language.pt')}</MenuItem>
                <MenuItem value="en">{t('language.en')}</MenuItem>
              </Select>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user.username}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {roleLabel}
              </Typography>
            </Box>
            {user.role === 'ENFERMEIRO' && (
              <Button
                variant="contained"
                color="error"
                onClick={handleUrgentAlert}
                sx={{ borderRadius: 3 }}
              >
                {t('alerts.urgentButton')}
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={handleOpenChat}
              sx={{
                borderRadius: 3,
                borderColor: '#b9d7f0',
                animation: chatPulse ? 'chatPulse 0.9s ease-in-out infinite' : 'none',
                '@keyframes chatPulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                  '100%': { transform: 'scale(1)' },
                },
              }}
            >
              <Badge color="error" badgeContent={totalUnread} invisible={totalUnread === 0}>
                <Box component="span">{t('chat.title')}</Box>
              </Badge>
            </Button>
            <Button variant="outlined" onClick={() => setPasswordOpen(true)} sx={{ borderRadius: 3, borderColor: '#b9d7f0' }}>
              {t('password.change')}
            </Button>
            <Button variant="outlined" onClick={handleLogout} sx={{ borderRadius: 3, borderColor: '#b9d7f0' }}>
              {t('app.logout')}
            </Button>
          </Box>
        )}
        </Toolbar>
      </AppBar>
      {user && (
        <Box sx={{ bgcolor: '#f2f8ff', borderBottom: '1px solid #d9e7f5' }}>
          <Container sx={{ py: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {(user.role === 'ADMINISTRATIVO' || user.role === 'ADMIN') && (
              <Button variant="text" onClick={() => navigate('/admin-dashboard')}>{t('admin.title')}</Button>
            )}
            {(user.role === 'ENFERMEIRO' || user.role === 'ADMIN') && (
              <Button variant="text" onClick={() => navigate('/nurse-dashboard')}>{t('nurse.title')}</Button>
            )}
            {(user.role === 'MEDICO' || user.role === 'ADMIN') && (
              <Button variant="text" onClick={() => navigate('/doctor-dashboard')}>{t('doctor.title')}</Button>
            )}
            {user.role === 'ADMIN' && (
              <Button variant="text" onClick={() => navigate('/admin-system-dashboard')}>{t('systemAdmin.title')}</Button>
            )}
            {user.role === 'ADMIN' && (
              <Button variant="text" onClick={() => navigate('/audit')}>{t('audit.title')}</Button>
            )}
            <Button variant="text" onClick={() => navigate('/history')}>{t('app.history')}</Button>
          </Container>
        </Box>
      )}
      <Container sx={{ mt: 4, mb: 6 }}>
        <Outlet />
      </Container>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        unreadByTarget={unreadByTarget}
        onReadTarget={handleReadTarget}
        onActiveTargetChange={setActiveChatTarget}
      />
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('password.change')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="password"
            label={t('password.current')}
            margin="normal"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            fullWidth
            type="password"
            label={t('password.new')}
            margin="normal"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="contained"
              onClick={async () => {
                try {
                  await axios.patch('/api/auth/password', { currentPassword, newPassword });
                  enqueueSnackbar(t('password.resetSuccess'), { variant: 'success' });
                  setCurrentPassword('');
                  setNewPassword('');
                  setPasswordOpen(false);
                } catch (error: any) {
                  enqueueSnackbar(error.response?.data?.error || t('password.resetError'), { variant: 'error' });
                }
              }}
            >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
