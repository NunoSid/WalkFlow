import React, { useEffect, useState } from 'react';
import { 
  Paper, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, IconButton, Button, Box, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { exportUtenteReportPdf } from '../utils/utenteReport';
import { getImageFormat, loadLogoDataUrl } from '../utils/pdfLogo';

export const RecentList = () => {
  const [utentes, setUtentes] = useState<any[]>([]);
  const [infoUtente, setInfoUtente] = useState<any | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canViewClinical = user?.role === 'MEDICO' || user?.role === 'ENFERMEIRO';

  const fetchRecent = async () => {
    try {
      const { data } = await axios.get('/api/utentes/recent');
      setUtentes(data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    fetchRecent();
    if (socket) {
        socket.on('new_utente', fetchRecent);
        socket.on('status_update', fetchRecent);
        socket.on('assessment_done', fetchRecent);
    }
    return () => {
        socket?.off('new_utente');
        socket?.off('status_update');
        socket?.off('assessment_done');
    };
  }, [socket]);

  const handleCancel = async (id: string) => {
      if (!window.confirm(t('widgets.cancelConfirm'))) return;
      try {
          await axios.delete(`/api/utentes/${id}/cancel`);
          fetchRecent();
      } catch (e) { alert(t('widgets.cancelError')); }
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

  const formatVitals = (assessment?: any) => {
    if (!assessment) return t('common.noData');
    const parts: string[] = [];
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
    doc.text(`${t('widgets.recentTitle')}`, headerX, 40);
    if (clinicName) doc.text(clinicName, headerX, 58);
    const head = [[t('table.arrivalTime'), t('table.name'), t('table.status'), t('table.color')]];
    const body = utentes.map((u) => [
      new Date(u.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      u.name,
      t(`statuses.${u.status}`),
      u.assessments?.[0]?.color ? t(`colors.${u.assessments[0].color}`) : '',
    ]);
    autoTable(doc, { head, body, startY: 80, styles: { fontSize: 8 } });
    doc.save('recentes.pdf');
  };

  const exportExcel = async () => {
    if (!utentes.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const xlsx = await import('xlsx');
    const header = [t('table.arrivalTime'), t('table.name'), t('table.status'), t('table.color')];
    const rows = utentes.map((u) => [
      new Date(u.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      u.name,
      t(`statuses.${u.status}`),
      u.assessments?.[0]?.color ? t(`colors.${u.assessments[0].color}`) : '',
    ]);
    const tableRows = [header, ...rows];
    if (clinicName) tableRows.unshift([clinicName], []);
    const sheet = xlsx.utils.aoa_to_sheet(tableRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'Recentes');
    xlsx.writeFile(wb, 'recentes.xlsx');
  };

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" gutterBottom>{t('widgets.recentTitle')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={exportExcel}>Excel</Button>
          <Button variant="outlined" size="small" onClick={exportPdf}>PDF</Button>
        </Box>
      </Box>
      <TableContainer sx={{ maxHeight: 300 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t('table.arrivalTime')}</TableCell>
              <TableCell>{t('table.name')}</TableCell>
              <TableCell>{t('table.status')}</TableCell>
              <TableCell>{t('table.color')}</TableCell>
              <TableCell align="right">{t('table.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {utentes.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.status === 'CANCELADO' ? 0.5 : 1 }}>
                <TableCell>{safeTime(u.arrivalTime)}</TableCell>
                <TableCell>
                  <Button variant="text" onClick={() => setInfoUtente(u)}>{u.name}</Button>
                </TableCell>
                <TableCell>{t(`statuses.${u.status}`)}</TableCell>
                <TableCell>
                    {u.assessments?.[0]?.color && (
                        <Chip 
                            label={t(`colors.${u.assessments[0].color}`)[0]} 
                            size="small" 
                            sx={{ 
                                bgcolor: u.assessments[0].color === 'VERMELHO' ? 'red' : u.assessments[0].color === 'AMARELO' ? '#ffab00' : 'green', 
                                color: 'white', width: 24, height: 24 
                            }} 
                        />
                    )}
                </TableCell>
                <TableCell align="right">
                    {/* Apenas Receção e Admin podem cancelar, e só se não estiver Encerrado/Cancelado */}
                    {(user?.role === 'ADMINISTRATIVO' || user?.role === 'ADMIN') && 
                     u.status !== 'CANCELADO' && u.status !== 'ENCERRADO' && (
                        <IconButton size="small" color="error" onClick={() => handleCancel(u.id)} title={t('common.cancel')}>
                            <CancelIcon fontSize="small" />
                        </IconButton>
                    )}
                </TableCell>
              </TableRow>
            ))}
            {utentes.length === 0 && <TableRow><TableCell colSpan={5} align="center">{t('widgets.noRecent')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={!!infoUtente} onClose={() => setInfoUtente(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('admin.name')}: {infoUtente?.name}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">{t('admin.process')}: {infoUtente?.processNumber || t('common.noData')}</Typography>
          <Typography variant="body2">{t('admin.dob')}: {safeDate(infoUtente?.dob)}</Typography>
          <Typography variant="body2">{t('admin.age')}: {infoUtente?.age ?? t('common.noData')}</Typography>
          <Typography variant="body2">{t('admin.gender')}: {infoUtente?.gender || t('common.noData')}</Typography>
          <Typography variant="body2">{t('admin.contact')}: {infoUtente?.contact || t('common.noData')}</Typography>
          <Typography variant="body2">{t('table.arrivalTime')}: {safeTime(infoUtente?.arrivalTime || '')}</Typography>
          {canViewClinical && (
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
          )}
        </DialogContent>
        <DialogActions>
          {canViewClinical && infoUtente?.id && (
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
    </Paper>
  );
};
