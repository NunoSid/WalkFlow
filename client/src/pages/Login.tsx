import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert, MenuItem, Select } from '@mui/material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicLogo, setClinicLogo] = useState('');
  const [showClinicLogo, setShowClinicLogo] = useState(true);
  const [showWalkflowLogo, setShowWalkflowLogo] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await axios.post('/api/auth/login', { username, password });
      login(data.user);
      
      // Redirecionamento baseado no Role
      if (data.user.role === 'ADMINISTRATIVO') navigate('/admin-dashboard');
      else if (data.user.role === 'ENFERMEIRO') navigate('/nurse-dashboard');
      else if (data.user.role === 'MEDICO') navigate('/doctor-dashboard');
      else if (data.user.role === 'ADMIN') navigate('/admin-system-dashboard');
      else if (data.user.role === 'TEMPOS_ESPERA') navigate('/wait-times');
      else navigate('/');

    } catch (err: any) {
      setError(t('login.error'));
    }
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('walkflow_lang', value);
  };

  useEffect(() => {
    axios.get('/api/settings/public')
      .then(({ data }) => {
        setClinicName(data?.clinicName || '');
        setClinicLogo(data?.clinicLogo || '');
        setShowClinicLogo(data?.showClinicLogo !== false);
        setShowWalkflowLogo(data?.showWalkflowLogo !== false);
      })
      .catch(() => {});
  }, []);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <Paper sx={{ p: 4, maxWidth: 420, width: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          {showWalkflowLogo && (
            <Box
              component="img"
              src="/logowf.png"
              alt="WalkFlow logo"
              sx={{ height: 120, mb: 1 }}
              onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          {showClinicLogo && clinicLogo && (
            <Box
              component="img"
              src={clinicLogo}
              alt="Clinic logo"
              sx={{ height: 90, mb: 1 }}
              onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          {clinicName && (
            <Typography variant="h6" align="center" sx={{ mb: 1 }}>
              {clinicName}
            </Typography>
          )}
          <Typography variant="body2" align="center" color="text.secondary">
            {t('login.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Select
            size="small"
            value={i18n.language}
            onChange={(event) => handleLanguageChange(event.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="pt">{t('language.pt')}</MenuItem>
            <MenuItem value="en">{t('language.en')}</MenuItem>
          </Select>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={t('login.username')}
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            fullWidth
            label={t('login.password')}
            type="password"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            {t('login.submit')}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};
