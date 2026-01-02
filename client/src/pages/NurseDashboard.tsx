import React, { useEffect, useState } from 'react';
import { 
  Paper, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, FormLabel, RadioGroup, FormControlLabel, 
  Radio, TextField, Chip, Box, Checkbox, Grid, Select, MenuItem, InputAdornment
} from '@mui/material';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { differenceInMonths } from 'date-fns';
import { useSnackbar } from 'notistack';
import { WaitTimesWidget } from '../components/WaitTimesWidget';
import { RecentList } from '../components/RecentList';
import { useTranslation } from 'react-i18next';
import { getImageFormat, loadLogoDataUrl } from '../utils/pdfLogo';
import { exportUtenteReportPdf } from '../utils/utenteReport';

interface Utente {
  id: string;
  name: string;
  age: number;
  dob: string;
  gender?: string;
  contact?: string;
  arrivalTime: string;
  processNumber: string;
  triageStartAt?: string | null;
  assessments?: any[];
}

export const NurseDashboard = () => {
  const [utentes, setUtentes] = useState<Utente[]>([]);
  const [retriageUtentes, setRetriageUtentes] = useState<Utente[]>([]);
  const [selectedUtente, setSelectedUtente] = useState<Utente | null>(null);
  const [isRetriage, setIsRetriage] = useState(false);
  const [color, setColor] = useState('');
  const [observations, setObservations] = useState('');
  const [ecgDone, setEcgDone] = useState(false);
  const [comburDone, setComburDone] = useState(false);
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [waitingRoom, setWaitingRoom] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [pain, setPain] = useState('');
  const [spo2, setSpo2] = useState('');
  const [glucose, setGlucose] = useState('');
  const [infoUtente, setInfoUtente] = useState<Utente | null>(null);
  const { socket } = useSocket();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const fetchUtentes = async () => {
    try {
      const { data } = await axios.get('/api/utentes/pending');
      if (Array.isArray(data)) {
        setUtentes(data);
      } else {
        setUtentes([]);
      }
    } catch (error) {
      console.error("Erro ao buscar lista:", error);
    }
  };

  const fetchRetriageUtentes = async () => {
    try {
      const { data } = await axios.get('/api/utentes/retriage');
      if (Array.isArray(data)) {
        setRetriageUtentes(data);
      } else {
        setRetriageUtentes([]);
      }
    } catch (error) {
      console.error("Erro ao buscar lista de re-triagem:", error);
    }
  };

  useEffect(() => {
    fetchUtentes();
    fetchRetriageUtentes();
    if (socket) {
      socket.on('new_utente', () => fetchUtentes());
      socket.on('status_update', () => fetchRetriageUtentes());
      socket.on('assessment_done', () => fetchRetriageUtentes());
    }
    return () => {
      socket?.off('new_utente');
      socket?.off('status_update');
      socket?.off('assessment_done');
    };
  }, [socket]);

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

  const exportPdf = async () => {
    if (!utentes.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const clinicLogo = settings?.clinicLogo;
    const showClinicLogo = settings?.showClinicLogo !== false;
    const showWalkflowLogo = settings?.showWalkflowLogo !== false;
    const jsPDFModule = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDFModule.default({ orientation: 'portrait', unit: 'pt', format: 'a4' });
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
    doc.text(t('nurse.title'), headerX, 40);
    if (clinicName) doc.text(clinicName, headerX, 58);
    const head = [[t('table.time'), t('table.name'), t('table.age')]];
    const body = utentes.map((u) => [
      safeTime(u.arrivalTime),
      u.name,
      u.age ?? '',
    ]);
    autoTable(doc, { head, body, startY: 80, styles: { fontSize: 9 } });
    doc.save('preavaliacao.pdf');
  };

  const exportExcel = async () => {
    if (!utentes.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const xlsx = await import('xlsx');
    const header = [t('table.time'), t('table.name'), t('table.age')];
    const rows = utentes.map((u) => [safeTime(u.arrivalTime), u.name, u.age ?? '']);
    const tableRows = [header, ...rows];
    if (clinicName) tableRows.unshift([clinicName], []);
    const sheet = xlsx.utils.aoa_to_sheet(tableRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'PreAvaliacao');
    xlsx.writeFile(wb, 'preavaliacao.xlsx');
  };

  const handleOpen = (utente: Utente) => {
    setSelectedUtente(utente);
    setIsRetriage(false);
    setColor('');
    setObservations('');
    setEcgDone(false);
    setComburDone(false);
    setBloodPressureSystolic('');
    setBloodPressureDiastolic('');
    setWaitingRoom('');
    setHeartRate('');
    setTemperature('');
    setRespiratoryRate('');
    setPain('');
    setSpo2('');
    setGlucose('');
    axios.patch(`/api/utentes/${utente.id}/triage-start`).catch(() => {});
  };

  const handleOpenRetriage = (utente: Utente) => {
    setSelectedUtente(utente);
    setIsRetriage(true);
    setColor('');
    setObservations('');
    setEcgDone(false);
    setComburDone(false);
    setBloodPressureSystolic('');
    setBloodPressureDiastolic('');
    setWaitingRoom('');
    setHeartRate('');
    setTemperature('');
    setRespiratoryRate('');
    setPain('');
    setSpo2('');
    setGlucose('');
  };

  const handleSave = async () => {
    if (!selectedUtente || !color) return;

    // Validação Idade < 3 meses (apenas aviso frontend, backend valida também)
    if (color === 'VERDE' && selectedUtente.dob) {
        try {
           const months = differenceInMonths(new Date(), new Date(selectedUtente.dob));
           if (months < 3) {
               enqueueSnackbar(t('nurse.warnBaby'), { variant: 'warning' });
               return;
           }
        } catch (e) {}
    }

    if ((bloodPressureSystolic || bloodPressureDiastolic) && (!bloodPressureSystolic || !bloodPressureDiastolic)) {
      enqueueSnackbar(t('vitals.bloodPressureIncomplete'), { variant: 'warning' });
      return;
    }

    const bloodPressure = (bloodPressureSystolic && bloodPressureDiastolic)
      ? `${bloodPressureSystolic}/${bloodPressureDiastolic}`
      : '';

    try {
      await axios.post('/api/assessments', {
        utenteId: selectedUtente.id,
        color,
        observations,
        ecgDone,
        comburDone,
        bloodPressure,
        waitingRoom,
        heartRate,
        temperature,
        respiratoryRate,
        pain,
        spo2,
        glucose,
      });
      enqueueSnackbar(t('nurse.saved'), { variant: 'success' });
      setSelectedUtente(null);
      setIsRetriage(false);
      fetchUtentes();
      fetchRetriageUtentes();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || t('nurse.saveError'), { variant: 'error' });
    }
  };

  return (
    <Box>
    <WaitTimesWidget />
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5">{t('nurse.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={exportExcel}>Excel</Button>
          <Button variant="outlined" size="small" onClick={exportPdf}>PDF</Button>
        </Box>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('table.time')}</TableCell>
              <TableCell>{t('table.name')}</TableCell>
              <TableCell>{t('table.age')}</TableCell>
              <TableCell>{t('table.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {utentes.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{safeTime(u.arrivalTime)}</TableCell>
                <TableCell>
                  <Button variant="text" onClick={() => setInfoUtente(u)}>{u.name}</Button>
                </TableCell>
                <TableCell>{u.age ? `${u.age}` : t('common.noData')}</TableCell>
                <TableCell>
                  <Button variant="contained" size="small" onClick={() => handleOpen(u)}>
                    {t('nurse.action')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {utentes.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">{t('nurse.empty')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('nurse.retriageTitle')}</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('table.arrivalTime')}</TableCell>
                <TableCell>{t('table.name')}</TableCell>
                <TableCell>{t('doctor.priority')}</TableCell>
                <TableCell>{t('table.action')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {retriageUtentes.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{safeTime(u.arrivalTime)}</TableCell>
                  <TableCell>
                    <Button variant="text" onClick={() => setInfoUtente(u)}>{u.name}</Button>
                  </TableCell>
                  <TableCell>
                    {u.assessments?.[0]?.color ? t(`colors.${u.assessments[0].color}`) : t('common.noData')}
                  </TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" onClick={() => handleOpenRetriage(u)}>
                      {t('nurse.retriageAction')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {retriageUtentes.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">{t('nurse.retriageEmpty')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={!!selectedUtente} onClose={() => setSelectedUtente(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {isRetriage ? t('nurse.retriageTitle') : t('nurse.triageTitle')}: {selectedUtente?.name}
        </DialogTitle>
        <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
                <Typography variant="body2">{t('table.age')}: {selectedUtente?.age ?? t('common.noData')}</Typography>
            </Box>
            
            <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend">{t('nurse.triageLegend')}</FormLabel>
                <RadioGroup row value={color} onChange={(e) => setColor(e.target.value)}>
                    <FormControlLabel 
                        value="VERMELHO" 
                        control={<Radio sx={{ color: 'red', '&.Mui-checked': { color: 'red' } }} />} 
                        label={<Chip label={t('colors.VERMELHO')} color="error" />} 
                    />
                    <FormControlLabel 
                        value="AMARELO" 
                        control={<Radio sx={{ color: '#fbc02d', '&.Mui-checked': { color: '#fbc02d' } }} />} 
                        label={<Chip label={t('colors.AMARELO')} sx={{ bgcolor: '#fbc02d', color: 'black' }} />} 
                    />
                    <FormControlLabel 
                        value="VERDE" 
                        control={<Radio sx={{ color: 'green', '&.Mui-checked': { color: 'green' } }} />} 
                        label={<Chip label={t('colors.VERDE')} color="success" />} 
                    />
                </RadioGroup>
            </FormControl>

            <Box sx={{ mt: 3 }}>
              <FormControlLabel
                control={<Checkbox checked={ecgDone} onChange={(e) => setEcgDone(e.target.checked)} />}
                label={t('nurse.ecg')}
              />
              <FormControlLabel
                control={<Checkbox checked={comburDone} onChange={(e) => setComburDone(e.target.checked)} />}
                label={t('nurse.combur')}
              />
            </Box>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    fullWidth
                    label={t('vitals.bloodPressure')}
                    value={bloodPressureSystolic}
                    onChange={(e) => setBloodPressureSystolic(e.target.value.replace(/\D/g, ''))}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <Typography variant="h6">/</Typography>
                  <TextField
                    fullWidth
                    label=" "
                    value={bloodPressureDiastolic}
                    onChange={(e) => setBloodPressureDiastolic(e.target.value.replace(/\D/g, ''))}
                    inputProps={{ inputMode: 'numeric', 'aria-label': t('vitals.bloodPressure') }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 44 }}>mmHg</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label={t('vitals.heartRate')}
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">bpm</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label={t('vitals.temperature')}
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label={t('vitals.respiratoryRate')}
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">/min</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label={t('vitals.pain')}
                  value={pain}
                  onChange={(e) => setPain(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">/10</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label={t('vitals.spo2')}
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label={t('vitals.glucose')}
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">mg/dL</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <FormLabel>{t('nurse.waitingRoom')}</FormLabel>
                  <Select
                    value={waitingRoom}
                    onChange={(e) => setWaitingRoom(e.target.value)}
                  >
                    <MenuItem value="OBS">{t('waitingRooms.OBS')}</MenuItem>
                    <MenuItem value="TRATAMENTOS">{t('waitingRooms.TRATAMENTOS')}</MenuItem>
                    <MenuItem value="ESPERA">{t('waitingRooms.ESPERA')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              multiline
              rows={3}
              label={t('nurse.observations')}
              sx={{ mt: 3 }}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setSelectedUtente(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} variant="contained" disabled={!color}>{t('nurse.conclude')}</Button>
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
            <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
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
    </Paper>
    <RecentList />
    </Box>
  );
};
