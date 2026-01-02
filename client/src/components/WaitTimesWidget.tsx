import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from 'react-i18next';

type WaitStats = {
  preAssessment?: { avgWait: number; count: number };
  doctor?: { avgWait: number; count: number; byColor: { color: string; wait: number; count: number }[] };
};

export const WaitTimesWidget = ({ showTitle = true }: { showTitle?: boolean }) => {
  const [stats, setStats] = useState<WaitStats>({});
  const { socket } = useSocket();
  const { t, i18n } = useTranslation();

  const fetchStats = async () => {
    try {
      const { data } = await axios.get('/api/utentes/stats');
      setStats(data || {});
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Atualizar a cada minuto
    
    if (socket) {
        socket.on('assessment_done', fetchStats);
        socket.on('status_update', fetchStats);
    }
    return () => {
        clearInterval(interval);
        socket?.off('assessment_done');
        socket?.off('status_update');
    };
  }, [socket]);

  const getColorStyle = (color: string) => {
      switch(color) {
          case 'VERMELHO': return { bgcolor: '#ffebee', color: '#d32f2f', border: '1px solid #ef9a9a' };
          case 'AMARELO': return { bgcolor: '#fffde7', color: '#f57f17', border: '1px solid #fff59d' };
          case 'VERDE': return { bgcolor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' };
          default: return {};
      }
  };

  const bilingualLabel = (key: string, options?: any) => {
    const base = t(key, options);
    if (i18n.language.startsWith('pt')) {
      const en = t(key, { ...(options || {}), lng: 'en' });
      return `${base} (${en})`;
    }
    return base;
  };

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: '#fafafa' }}>
        {showTitle && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccessTimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.secondary">{bilingualLabel('widgets.waitTitle')}</Typography>
          </Box>
        )}
        <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
                <Card elevation={0} sx={{ bgcolor: '#eef7ff', color: '#0b3d5c', border: '1px solid #cfe4ff', textAlign: 'center' }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {bilingualLabel('widgets.preAssessmentWait')}
                        </Typography>
                        <Typography variant="h4">
                          {stats.preAssessment?.avgWait ?? 0}
                          <small style={{fontSize: '0.5em'}}> {t('common.minutes')}</small>
                        </Typography>
                        <Typography variant="caption">
                          {bilingualLabel('widgets.waitingCount', { count: stats.preAssessment?.count ?? 0 })}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card elevation={0} sx={{ bgcolor: '#fff7e6', color: '#7a4b00', border: '1px solid #ffe0a3', textAlign: 'center' }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {bilingualLabel('widgets.doctorWait')}
                        </Typography>
                        <Typography variant="h4">
                          {stats.doctor?.avgWait ?? 0}
                          <small style={{fontSize: '0.5em'}}> {t('common.minutes')}</small>
                        </Typography>
                        <Typography variant="caption">
                          {bilingualLabel('widgets.waitingCount', { count: stats.doctor?.count ?? 0 })}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            {(stats.doctor?.byColor || []).map((s) => (
                <Grid item xs={4} key={s.color}>
                    <Card elevation={0} sx={{ ...getColorStyle(s.color), textAlign: 'center' }}>
                        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{t(`colors.${s.color}`)}</Typography>
                            <Typography variant="h4">
                              {s.wait ?? 0}
                              <small style={{fontSize: '0.5em'}}> {t('common.minutes')}</small>
                            </Typography>
                            <Typography variant="caption">{t('widgets.waitingCount', { count: s.count })}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    </Paper>
  );
};
