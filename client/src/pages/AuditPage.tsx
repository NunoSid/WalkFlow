import { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Box,
} from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { getImageFormat, loadLogoDataUrl } from '../utils/pdfLogo';

export const AuditPage = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [action, setAction] = useState('');
  const [utenteQuery, setUtenteQuery] = useState('');

  const formatAction = (value: string) => t(`audit.actions.${value}`, { defaultValue: value });

  const fetchLogs = async () => {
    const params: any = {};
    if (start) params.start = start;
    if (end) params.end = end;
    if (action) params.action = action;
    if (utenteQuery) params.utente = utenteQuery;
    const { data } = await axios.get('/api/audit/logs', { params });
    setLogs(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const exportPdf = async () => {
    if (!logs.length) return;
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
    doc.text(t('audit.title'), headerX, 40);
    if (clinicName) doc.text(clinicName, headerX, 58);
    const head = [[t('audit.date'), t('audit.user'), t('audit.patient'), t('audit.action'), t('audit.details')]];
    const body = logs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.user?.fullName || log.user?.username || '',
      log.utente ? `${log.utente.name} (${log.utente.processNumber})` : '',
      formatAction(log.action),
      log.details || '',
    ]);
    autoTable(doc, { head, body, startY: 80, styles: { fontSize: 8 } });
    doc.save('auditoria.pdf');
  };

  const exportExcel = async () => {
    if (!logs.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const xlsx = await import('xlsx');
    const header = [t('audit.date'), t('audit.user'), t('audit.patient'), t('audit.action'), t('audit.details')];
    const rows = logs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.user?.fullName || log.user?.username || '',
      log.utente ? `${log.utente.name} (${log.utente.processNumber})` : '',
      formatAction(log.action),
      log.details || '',
    ]);
    const tableRows = [header, ...rows];
    if (clinicName) tableRows.unshift([clinicName], []);
    const sheet = xlsx.utils.aoa_to_sheet(tableRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'Auditoria');
    xlsx.writeFile(wb, 'auditoria.xlsx');
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">{t('audit.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={exportExcel}>Excel</Button>
          <Button variant="outlined" size="small" onClick={exportPdf}>PDF</Button>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          type="date"
          label={t('audit.start')}
          InputLabelProps={{ shrink: true }}
          size="small"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          type="date"
          label={t('audit.end')}
          InputLabelProps={{ shrink: true }}
          size="small"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <TextField
          label={t('audit.action')}
          size="small"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <TextField
          label={t('audit.patientSearch')}
          size="small"
          value={utenteQuery}
          onChange={(e) => setUtenteQuery(e.target.value)}
        />
        <Button variant="contained" onClick={fetchLogs}>{t('common.update')}</Button>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('audit.date')}</TableCell>
              <TableCell>{t('audit.user')}</TableCell>
              <TableCell>{t('audit.patient')}</TableCell>
              <TableCell>{t('audit.action')}</TableCell>
              <TableCell>{t('audit.details')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                <TableCell>{log.user?.fullName || log.user?.username || ''}</TableCell>
                <TableCell>
                  {log.utente ? `${log.utente.name} (${log.utente.processNumber})` : ''}
                </TableCell>
                <TableCell>{formatAction(log.action)}</TableCell>
                <TableCell>{log.details || ''}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">{t('common.noData')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
