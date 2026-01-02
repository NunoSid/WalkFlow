import React, { useEffect, useState } from 'react';
import { 
  Paper, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, TextField, Box, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getImageFormat, loadLogoDataUrl } from '../utils/pdfLogo';
import { exportUtenteReportPdf } from '../utils/utenteReport';

export const HistoryPage = () => {
  const [utentes, setUtentes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [infoUtente, setInfoUtente] = useState<any | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const canViewClinical = user?.role === 'MEDICO' || user?.role === 'ENFERMEIRO';

  const fetchHistory = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (date) params.date = date;

      const { data } = await axios.get('/api/utentes/history', { params });
      setUtentes(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [search, date]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('history.deleteConfirm'))) return;
    try {
      await axios.delete(`/api/utentes/${id}`);
      enqueueSnackbar(t('history.deleteSuccess'), { variant: 'success' });
      fetchHistory();
    } catch (e) {
      enqueueSnackbar(t('history.deleteError'), { variant: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
      if (status === 'ENCERRADO') return 'default';
      if (status === 'CANCELADO') return 'error';
      if (status === 'AGUARDANDO_PRE_AVALIACAO') return 'info';
      return 'primary';
  };

  const getDuration = (u: any) => {
      if (!u.completedAt) return '-';
      const start = new Date(u.arrivalTime).getTime();
      const end = new Date(u.completedAt).getTime();
      const diff = Math.round((end - start) / 60000);
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return `${hours}h ${mins}m`;
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
    doc.text(t('history.title'), headerX, 40);
    if (clinicName) doc.text(clinicName, headerX, 58);
    const head = [[
      t('table.dateTime'),
      t('table.process'),
      t('table.name'),
      t('table.priority'),
      t('history.duration'),
      t('history.individualWait'),
      t('table.status'),
    ]];
    const body = utentes.map((u) => [
      new Date(u.arrivalTime).toLocaleString(),
      u.processNumber,
      u.name,
      u.assessments?.[0]?.color ? t(`colors.${u.assessments[0].color}`) : '',
      getDuration(u),
      u.triageStartAt
        ? Math.round((new Date(u.triageStartAt).getTime() - new Date(u.arrivalTime).getTime()) / 60000)
        : '',
      t(`statuses.${u.status}`),
    ]);
    autoTable(doc, { head, body, startY: 80, styles: { fontSize: 8 } });
    doc.save('historico.pdf');
  };

  const exportExcel = async () => {
    if (!utentes.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const xlsx = await import('xlsx');
    const header = [
      t('table.dateTime'),
      t('table.process'),
      t('table.name'),
      t('table.priority'),
      t('history.duration'),
      t('history.individualWait'),
      t('table.status'),
    ];
    const rows = utentes.map((u) => [
      new Date(u.arrivalTime).toLocaleString(),
      u.processNumber,
      u.name,
      u.assessments?.[0]?.color ? t(`colors.${u.assessments[0].color}`) : '',
      getDuration(u),
      u.triageStartAt
        ? Math.round((new Date(u.triageStartAt).getTime() - new Date(u.arrivalTime).getTime()) / 60000)
        : '',
      t(`statuses.${u.status}`),
    ]);
    const tableRows = [header, ...rows];
    if (clinicName) tableRows.unshift([clinicName], []);
    const sheet = xlsx.utils.aoa_to_sheet(tableRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'Historico');
    xlsx.writeFile(wb, 'historico.xlsx');
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>{t('history.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={exportExcel}>Excel</Button>
          <Button variant="outlined" size="small" onClick={exportPdf}>PDF</Button>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField 
            label={t('history.search')} 
            variant="outlined" 
            size="small" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1 }}
        />
        <TextField 
            type="date"
            label={t('history.date')} 
            InputLabelProps={{ shrink: true }}
            variant="outlined" 
            size="small" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
        />
        <Button variant="contained" onClick={fetchHistory}>{t('common.update')}</Button>
      </Box>

      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t('table.dateTime')}</TableCell>
              <TableCell>{t('table.process')}</TableCell>
              <TableCell>{t('table.name')}</TableCell>
              <TableCell>{t('table.priority')}</TableCell>
              <TableCell>{t('history.duration')}</TableCell>
              <TableCell>{t('history.individualWait')}</TableCell>
              <TableCell>{t('table.status')}</TableCell>
              {user?.role === 'ADMIN' && <TableCell>{t('table.action')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {utentes.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.status === 'CANCELADO' ? 0.5 : 1 }}>
                <TableCell>{new Date(u.arrivalTime).toLocaleString()}</TableCell>
                <TableCell>{u.processNumber}</TableCell>
                <TableCell>
                  <Button variant="text" onClick={() => setInfoUtente(u)}>{u.name}</Button>
                </TableCell>
                <TableCell>
                    {u.assessments?.[0]?.color ? (
                        <Chip 
                            label={t(`colors.${u.assessments[0].color}`)} 
                            size="small" 
                            sx={{ 
                                bgcolor: u.assessments[0].color === 'VERMELHO' ? 'red' : u.assessments[0].color === 'AMARELO' ? '#ffab00' : 'green', 
                                color: 'white'
                            }} 
                        />
                    ) : '-'}
                </TableCell>
                <TableCell>{getDuration(u)}</TableCell>
                <TableCell>
                  {u.triageStartAt
                    ? `${Math.round((new Date(u.triageStartAt).getTime() - new Date(u.arrivalTime).getTime()) / 60000)} ${t('common.minutes')}`
                    : t('common.noData')}
                </TableCell>
                <TableCell>
                    <Chip label={t(`statuses.${u.status}`)} color={getStatusColor(u.status) as any} size="small" />
                </TableCell>
                {user?.role === 'ADMIN' && (
                    <TableCell>
                        <IconButton color="error" onClick={() => handleDelete(u.id)}>
                            <DeleteIcon />
                        </IconButton>
                    </TableCell>
                )}
              </TableRow>
            ))}
            {utentes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={user?.role === 'ADMIN' ? 9 : 8} align="center">{t('common.noResults')}</TableCell>
                </TableRow>
            )}
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
