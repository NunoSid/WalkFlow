import React, { useEffect, useState } from 'react';
import { 
  Paper, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Chip, Box, Dialog, DialogTitle, DialogContent, DialogActions 
} from '@mui/material';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useSnackbar } from 'notistack';
import { WaitTimesWidget } from '../components/WaitTimesWidget';
import { RecentList } from '../components/RecentList';
import { useTranslation } from 'react-i18next';
import { getImageFormat, loadLogoDataUrl } from '../utils/pdfLogo';
import { exportUtenteReportPdf } from '../utils/utenteReport';

interface Assessment {
    color: 'VERDE' | 'AMARELO' | 'VERMELHO';
    createdAt: string;
    ecgDone?: boolean;
    comburDone?: boolean;
    bloodPressure?: string | null;
    waitingRoom?: string | null;
    heartRate?: number | null;
    temperature?: number | null;
    respiratoryRate?: number | null;
    pain?: number | null;
    spo2?: number | null;
    glucose?: number | null;
    observations?: string | null;
}

interface Utente {
  id: string;
  name: string;
  age: number;
  dob?: string | null;
  gender?: string | null;
  contact?: string | null;
  arrivalTime: string;
  processNumber?: string;
  assessments: Assessment[];
  status: string;
  individualWait?: number | null;
  waitEstimate?: number | null;
}

export const DoctorDashboard = () => {
  const [utentes, setUtentes] = useState<Utente[]>([]);
  const [urgentAlert, setUrgentAlert] = useState<{ message: string; fromUser?: string } | null>(null);
  const [infoUtente, setInfoUtente] = useState<Utente | null>(null);
  const [urgentSoundUrl, setUrgentSoundUrl] = useState('/alert_beep.mp3');
  const { socket } = useSocket();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const fetchList = async () => {
    try {
      const { data } = await axios.get('/api/utentes/doctor');
      setUtentes(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchList();
    if (socket) {
      socket.on('assessment_done', () => fetchList());
      socket.on('status_update', () => fetchList());
      socket.on('urgent_alert', (payload: any) => {
        const message = payload?.message || 'ATENÇÃO IMEDIATA';
        const fromUser = payload?.fromUserName || payload?.fromUserId || '';
        setUrgentAlert({ message, fromUser });
        try {
          const audio = new Audio(urgentSoundUrl || '/alert_beep.mp3');
          audio.loop = true;
          audio.play().catch(() => {});
          (window as any).__urgentAudio = audio;
        } catch (e) {}
      });
      socket.on('urgent_alert_clear', () => {
        setUrgentAlert(null);
        const audio = (window as any).__urgentAudio as HTMLAudioElement | undefined;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    }
    return () => {
        socket?.off('assessment_done');
        socket?.off('status_update');
        socket?.off('urgent_alert');
        socket?.off('urgent_alert_clear');
        const audio = (window as any).__urgentAudio as HTMLAudioElement | undefined;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
    };
  }, [socket, urgentSoundUrl]);

  useEffect(() => {
    axios.get('/api/settings/public')
      .then(({ data }) => {
        setUrgentSoundUrl(data?.alertSoundUrl || '/alert_beep.mp3');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleSettings = (data: any) => {
      if (data && Object.prototype.hasOwnProperty.call(data, 'alertSoundUrl')) {
        setUrgentSoundUrl(data?.alertSoundUrl || '/alert_beep.mp3');
      } else {
        axios.get('/api/settings/public')
          .then(({ data }) => setUrgentSoundUrl(data?.alertSoundUrl || '/alert_beep.mp3'))
          .catch(() => {});
      }
    };
    socket.on('settings_updated', handleSettings);
    return () => {
      socket.off('settings_updated', handleSettings);
    };
  }, [socket]);

  const handleStatusChange = async (id: string, status: string) => {
      try {
          await axios.patch(`/api/utentes/${id}/status`, { status });
          enqueueSnackbar(t('doctor.statusUpdated', { status: t(`statuses.${status}`) }), { variant: 'success' });
          fetchList();
      } catch (e) {
          enqueueSnackbar(t('doctor.statusError'), { variant: 'error' });
      }
  };

  const getColorChip = (color: string) => {
      const map: Record<string, any> = {
          'VERMELHO': { color: 'error', label: t('colors.VERMELHO') },
          'AMARELO': { color: 'warning', label: t('colors.AMARELO'), style: { color: 'white' } },
          'VERDE': { color: 'success', label: t('colors.VERDE') }
      };
      const c = map[color] || {};
      return <Chip label={c.label} color={c.color} sx={c.style} size="small" />;
  };

  const exportPdf = async () => {
    if (!utentes.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const clinicLogo = settings?.clinicLogo;
    const showClinicLogo = settings?.showClinicLogo !== false;
    const showWalkflowLogo = settings?.showWalkflowLogo !== false;
    const jsPDFModule = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDFModule.default({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const logoData = await loadLogoDataUrl();
    if (showWalkflowLogo && logoData) doc.addImage(logoData, 'PNG', 40, 18, 50, 50);
    if (showClinicLogo && clinicLogo) {
      const clinicX = showWalkflowLogo && logoData ? 100 : 40;
      doc.addImage(clinicLogo, getImageFormat(clinicLogo), clinicX, 18, 50, 50);
    }
    const headerX = (showWalkflowLogo && logoData) || (showClinicLogo && clinicLogo)
      ? ((showWalkflowLogo && logoData) && (showClinicLogo && clinicLogo) ? 160 : 100)
      : 40;
    doc.setFontSize(14);
    doc.text(t('doctor.title'), headerX, 40);
    if (clinicName) doc.text(clinicName, headerX, 58);
    const head = [[
      t('doctor.priority'),
      t('doctor.assessmentTime'),
      t('table.name'),
      t('table.age'),
      t('doctor.waitTime'),
      t('doctor.individualWait'),
      t('doctor.estimatedWait'),
      t('doctor.observations'),
    ]];
    const body = utentes.map((u) => {
      const assessment = u.assessments[0];
      const time = new Date(assessment?.createdAt || u.arrivalTime);
      return [
        assessment?.color ? t(`colors.${assessment.color}`) : '',
        time.toLocaleTimeString(),
        u.name,
        u.age ?? '',
        Math.floor((Date.now() - time.getTime()) / 60000),
        u.individualWait ?? '',
        u.waitEstimate ?? '',
        assessment?.observations || '',
      ];
    });
    autoTable(doc, { head, body, startY: 80, styles: { fontSize: 8 } });
    doc.save('lista_medica.pdf');
  };

  const exportExcel = async () => {
    if (!utentes.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const xlsx = await import('xlsx');
    const header = [
      t('doctor.priority'),
      t('doctor.assessmentTime'),
      t('table.name'),
      t('table.age'),
      t('doctor.waitTime'),
      t('doctor.individualWait'),
      t('doctor.estimatedWait'),
      t('doctor.observations'),
    ];
    const rows = utentes.map((u) => {
      const assessment = u.assessments[0];
      const time = new Date(assessment?.createdAt || u.arrivalTime);
      return [
        assessment?.color ? t(`colors.${assessment.color}`) : '',
        time.toLocaleTimeString(),
        u.name,
        u.age ?? '',
        Math.floor((Date.now() - time.getTime()) / 60000),
        u.individualWait ?? '',
        u.waitEstimate ?? '',
        assessment?.observations || '',
      ];
    });
    const tableRows = [header, ...rows];
    if (clinicName) tableRows.unshift([clinicName], []);
    const sheet = xlsx.utils.aoa_to_sheet(tableRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'ListaMedica');
    xlsx.writeFile(wb, 'lista_medica.xlsx');
  };

  const formatVitals = (assessment?: Assessment) => {
    if (!assessment) return t('common.noData');
    const parts = [];
    if (assessment.bloodPressure) parts.push(`TA ${assessment.bloodPressure} mmHg`);
    if (assessment.heartRate !== null && assessment.heartRate !== undefined) parts.push(`FC ${assessment.heartRate} bpm`);
    if (assessment.temperature !== null && assessment.temperature !== undefined) parts.push(`T ${assessment.temperature} °C`);
    if (assessment.respiratoryRate !== null && assessment.respiratoryRate !== undefined) parts.push(`FR ${assessment.respiratoryRate} /min`);
    if (assessment.spo2 !== null && assessment.spo2 !== undefined) parts.push(`SpO2 ${assessment.spo2}%`);
    if (assessment.glucose !== null && assessment.glucose !== undefined) parts.push(`Glic ${assessment.glucose} mg/dL`);
    if (assessment.pain !== null && assessment.pain !== undefined) parts.push(`Dor ${assessment.pain}/10`);
    if (assessment.ecgDone) parts.push('ECG');
    if (assessment.comburDone) parts.push('COMBUR');
    if (assessment.waitingRoom) parts.push(`${t('nurse.waitingRoom')}: ${t(`waitingRooms.${assessment.waitingRoom}`)}`);
    return parts.length ? parts.join(' · ') : t('common.noData');
  };

  const safeTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return '--:--'; }
  };

  const safeDate = (dateStr?: string | null) => {
    if (!dateStr) return t('common.noData');
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch { return t('common.noData'); }
  };

  return (
    <Box>
    <WaitTimesWidget />
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5">{t('doctor.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={exportExcel}>Excel</Button>
          <Button variant="outlined" size="small" onClick={exportPdf}>PDF</Button>
        </Box>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('doctor.priority')}</TableCell>
              <TableCell>{t('doctor.assessmentTime')}</TableCell>
              <TableCell>{t('table.name')}</TableCell>
              <TableCell>{t('table.age')}</TableCell>
              <TableCell>{t('doctor.waitTime')}</TableCell>
              <TableCell>{t('doctor.individualWait')}</TableCell>
              <TableCell>{t('doctor.estimatedWait')}</TableCell>
              <TableCell>{t('doctor.observations')}</TableCell>
              <TableCell>{t('table.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {utentes.map((u) => {
                const assessment = u.assessments[0];
                const color = assessment?.color || 'VERDE';
                const time = new Date(assessment?.createdAt || u.arrivalTime);
                
                return (
              <TableRow key={u.id} sx={{ bgcolor: u.status === 'EM_ATENDIMENTO' ? '#e3f2fd' : 'inherit' }}>
                <TableCell>{getColorChip(color)}</TableCell>
                <TableCell>{time.toLocaleTimeString()}</TableCell>
                <TableCell>
                  <Button variant="text" onClick={() => setInfoUtente(u)}>{u.name}</Button>
                </TableCell>
                <TableCell>{u.age}</TableCell>
                <TableCell>
                    {Math.floor((Date.now() - time.getTime()) / 60000)} {t('common.minutes')}
                </TableCell>
                <TableCell>
                    {u.individualWait !== null && u.individualWait !== undefined ? `${u.individualWait} ${t('common.minutes')}` : t('common.noData')}
                </TableCell>
                <TableCell>
                    {u.waitEstimate !== null && u.waitEstimate !== undefined ? `${u.waitEstimate} ${t('common.minutes')}` : t('common.noData')}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {assessment?.observations || t('common.noData')}
                  </Typography>
                </TableCell>
                <TableCell>
                  {u.status === 'AGUARDANDO_MEDICO' && (
                      <Button variant="contained" onClick={() => handleStatusChange(u.id, 'EM_ATENDIMENTO')}>
                          {t('doctor.call')}
                      </Button>
                  )}
                  {u.status === 'EM_ATENDIMENTO' && (
                      <Button variant="outlined" color="success" onClick={() => handleStatusChange(u.id, 'ENCERRADO')}>
                          {t('doctor.discharge')}
                      </Button>
                  )}
                </TableCell>
              </TableRow>
            )})}
             {utentes.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center">{t('doctor.empty')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
    <Dialog open={!!urgentAlert} fullWidth maxWidth="sm">
      <DialogContent sx={{ textAlign: 'center', py: 6, bgcolor: '#b71c1c', color: '#fff' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          {urgentAlert?.message || 'ATENÇÃO IMEDIATA'}
        </Typography>
        {urgentAlert?.fromUser && (
          <Typography variant="h6">
            {t('alerts.fromNurse', { name: urgentAlert.fromUser })}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', py: 2 }}>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            setUrgentAlert(null);
            const audio = (window as any).__urgentAudio as HTMLAudioElement | undefined;
            if (audio) {
              audio.pause();
              audio.currentTime = 0;
            }
            socket?.emit('urgent_alert_clear');
          }}
        >
          {t('alerts.stopAlert')}
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={!!infoUtente} onClose={() => setInfoUtente(null)} fullWidth maxWidth="sm">
      <DialogTitle>{t('admin.name')}: {infoUtente?.name}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">{t('admin.process')}: {infoUtente?.processNumber || t('common.noData')}</Typography>
        <Typography variant="body2">{t('admin.dob')}: {safeDate(infoUtente?.dob)}</Typography>
        <Typography variant="body2">{t('admin.age')}: {infoUtente?.age ?? t('common.noData')}</Typography>
        <Typography variant="body2">{t('admin.gender')}: {infoUtente?.gender || t('common.noData')}</Typography>
        <Typography variant="body2">{t('admin.contact')}: {infoUtente?.contact || t('common.noData')}</Typography>
        <Typography variant="body2">{t('table.arrivalTime')}: {safeTime(infoUtente?.arrivalTime || '')}</Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('nurse.triageTitle')}</Typography>
          <Typography variant="body2">
            {infoUtente?.assessments?.[0]?.color ? t(`colors.${infoUtente.assessments[0].color}`) : t('common.noData')}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {infoUtente?.assessments?.[0]?.observations || t('common.noData')}
          </Typography>
          <Typography variant="body2">{formatVitals(infoUtente?.assessments?.[0])}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        {infoUtente?.id && (
          <Button
            variant="outlined"
            onClick={() => exportUtenteReportPdf(infoUtente.id, t)}
          >
            {t('report.export')}
          </Button>
        )}
        <Button onClick={() => setInfoUtente(null)}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
    <RecentList />
    </Box>
  );
};
