import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import axios from 'axios';
import { WaitTimesWidget } from '../components/WaitTimesWidget';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from 'react-i18next';

export const WaitTimesScreen = () => {
  const [clinicName, setClinicName] = useState('');
  const [clinicLogo, setClinicLogo] = useState('');
  const [showClinicLogo, setShowClinicLogo] = useState(true);
  const [showWalkflowLogo, setShowWalkflowLogo] = useState(true);
  const { socket } = useSocket();
  const { t, i18n } = useTranslation();

  const applySettings = React.useCallback((data: any) => {
    setClinicName(data?.clinicName || '');
    setClinicLogo(data?.clinicLogo || '');
    setShowClinicLogo(data?.showClinicLogo !== false);
    setShowWalkflowLogo(data?.showWalkflowLogo !== false);
  }, []);

  const isSettingsPayload = React.useCallback((data: any) => {
    if (!data || typeof data !== 'object') return false;
    return (
      'clinicName' in data ||
      'clinicLogo' in data ||
      'showClinicLogo' in data ||
      'showWalkflowLogo' in data
    );
  }, []);

  const refreshSettings = React.useCallback(() => {
    axios.get('/api/settings/public')
      .then(({ data }) => applySettings(data))
      .catch(() => {});
  }, [applySettings]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!socket) return;
    const handleSettings = (data: any) => {
      if (isSettingsPayload(data)) applySettings(data);
      else refreshSettings();
    };
    socket.on('settings_updated', handleSettings);
    return () => {
      socket.off('settings_updated', handleSettings);
    };
  }, [socket, applySettings, refreshSettings, isSettingsPayload]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f9ff', p: 4 }}>
      <Typography variant="h3" sx={{ textAlign: 'center', mb: 2, fontWeight: 700 }}>
        {i18n.language.startsWith('pt')
          ? `${t('waitTimes.title')} (${t('waitTimes.title', { lng: 'en' })})`
          : t('waitTimes.title')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
        {showWalkflowLogo && (
          <Box
            component="img"
            src="/logowf.png"
            alt="WalkFlow logo"
            sx={{ height: 60 }}
          />
        )}
        {showClinicLogo && clinicLogo && (
          <Box
            component="img"
            src={clinicLogo}
            alt="Clinic logo"
            sx={{ height: 52 }}
          />
        )}
        {clinicName && (
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {clinicName}
          </Typography>
        )}
      </Box>
      <WaitTimesWidget showTitle={false} />
    </Box>
  );
};
