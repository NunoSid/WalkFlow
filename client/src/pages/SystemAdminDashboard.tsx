import React, { useEffect, useState } from 'react';
import { 
  Paper, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Grid, Box, Switch, FormControlLabel
} from '@mui/material';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getImageFormat, loadLogoDataUrl } from '../utils/pdfLogo';
import { useAuth } from '../context/AuthContext';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive?: boolean;
}

export const SystemAdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicLogo, setClinicLogo] = useState('');
  const [showClinicLogo, setShowClinicLogo] = useState(true);
  const [showWalkflowLogo, setShowWalkflowLogo] = useState(true);
  const [alertSoundUrl, setAlertSoundUrl] = useState('');
  const [notificationSoundUrl, setNotificationSoundUrl] = useState('');
  const [clinicLogoFile, setClinicLogoFile] = useState<File | null>(null);
  const [alertSoundFile, setAlertSoundFile] = useState<File | null>(null);
  const [notificationSoundFile, setNotificationSoundFile] = useState<File | null>(null);
  const [clearClinicLogo, setClearClinicLogo] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { register, handleSubmit, reset } = useForm();
  const { t } = useTranslation();

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/api/auth/users');
      setUsers(Array.isArray(data) ? data.filter((u) => u.isActive !== false) : []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchClinicName = async () => {
    try {
      const { data } = await axios.get('/api/settings/public');
      setClinicName(data?.clinicName || '');
      setClinicLogo(data?.clinicLogo || '');
      setShowClinicLogo(data?.showClinicLogo !== false);
      setShowWalkflowLogo(data?.showWalkflowLogo !== false);
      setAlertSoundUrl(data?.alertSoundUrl || '');
      setNotificationSoundUrl(data?.notificationSoundUrl || '');
    } catch (error) {
      console.error(error);
    }
  };

  const exportPdf = async () => {
    if (!users.length) return;
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
    doc.text(t('systemAdmin.title'), headerX, 40);
    if (clinicName) doc.text(clinicName, headerX, 58);
    const head = [[t('systemAdmin.fullName'), t('systemAdmin.username'), t('systemAdmin.role')]];
    const body = users.map((u) => [u.fullName, u.username, t(`roles.${u.role}`)]);
    autoTable(doc, { head, body, startY: 80, styles: { fontSize: 9 } });
    doc.save('utilizadores.pdf');
  };

  const exportExcel = async () => {
    if (!users.length) return;
    const { data: settings } = await axios.get('/api/settings/public');
    const clinicName = settings?.clinicName;
    const xlsx = await import('xlsx');
    const header = [t('systemAdmin.fullName'), t('systemAdmin.username'), t('systemAdmin.role')];
    const rows = users.map((u) => [u.fullName, u.username, t(`roles.${u.role}`)]);
    const tableRows = [header, ...rows];
    if (clinicName) tableRows.unshift([clinicName], []);
    const sheet = xlsx.utils.aoa_to_sheet(tableRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'Utilizadores');
    xlsx.writeFile(wb, 'utilizadores.xlsx');
  };

  useEffect(() => {
    fetchUsers();
    fetchClinicName();
  }, []);

  const onSubmit = async (data: any) => {
    try {
      await axios.post('/api/auth/register', data);
      enqueueSnackbar(t('systemAdmin.created'), { variant: 'success' });
      setOpen(false);
      reset();
      fetchUsers();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || t('systemAdmin.createError'), { variant: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    try {
      await axios.patch(`/api/auth/users/${selectedUser.id}/password`, { newPassword });
      enqueueSnackbar(t('password.resetSuccess'), { variant: 'success' });
      setResetOpen(false);
      setNewPassword('');
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || t('password.resetError'), { variant: 'error' });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (user?.id === selectedUser.id) {
      enqueueSnackbar(t('systemAdmin.deleteSelf'), { variant: 'warning' });
      return;
    }
    try {
      await axios.delete(`/api/auth/users/${selectedUser.id}`);
      enqueueSnackbar(t('systemAdmin.deleteSuccess'), { variant: 'success' });
      setDeleteOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || t('systemAdmin.deleteError'), { variant: 'error' });
    }
  };

  const handleSaveClinicName = async () => {
    try {
      await axios.patch('/api/settings', { clinicName, showClinicLogo, showWalkflowLogo, alertSoundUrl, notificationSoundUrl, clinicLogo });
      enqueueSnackbar(t('systemAdmin.clinicSaved'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || t('systemAdmin.clinicError'), { variant: 'error' });
    }
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleUploadAssets = async () => {
    try {
      const payload: any = {
        showClinicLogo,
        showWalkflowLogo,
      };
      if (clinicName) payload.clinicName = clinicName;
      if (clinicLogoFile) payload.clinicLogo = await readFileAsDataUrl(clinicLogoFile);
      if (alertSoundFile) payload.alertSoundUrl = await readFileAsDataUrl(alertSoundFile);
      if (notificationSoundFile) payload.notificationSoundUrl = await readFileAsDataUrl(notificationSoundFile);
      if (!alertSoundFile && alertSoundUrl === '') payload.alertSoundUrl = '';
      if (!notificationSoundFile && notificationSoundUrl === '') payload.notificationSoundUrl = '';

      if (clearClinicLogo) payload.clinicLogo = '';
      await axios.patch('/api/settings', payload);
      enqueueSnackbar(t('systemAdmin.assetsSaved'), { variant: 'success' });
      setClinicLogoFile(null);
      setAlertSoundFile(null);
      setNotificationSoundFile(null);
      setClearClinicLogo(false);
      fetchClinicName();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || t('systemAdmin.assetsError'), { variant: 'error' });
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{t('systemAdmin.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={exportExcel}>Excel</Button>
          <Button variant="outlined" size="small" onClick={exportPdf}>PDF</Button>
          <Button variant="contained" onClick={() => setOpen(true)}>{t('systemAdmin.newUser')}</Button>
        </Box>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label={t('systemAdmin.clinicName')}
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
          size="small"
          sx={{ minWidth: 260 }}
        />
        <Button variant="contained" onClick={handleSaveClinicName}>
          {t('systemAdmin.clinicSave')}
        </Button>
        <FormControlLabel
          control={<Switch checked={showWalkflowLogo} onChange={(e) => setShowWalkflowLogo(e.target.checked)} />}
          label={t('systemAdmin.showWalkflowLogo')}
        />
        <FormControlLabel
          control={<Switch checked={showClinicLogo} onChange={(e) => setShowClinicLogo(e.target.checked)} />}
          label={t('systemAdmin.showClinicLogo')}
        />
      </Box>

      <Box sx={{ mb: 3, display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" component="label">
            {t('systemAdmin.uploadClinicLogo')}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                setClinicLogoFile(e.target.files?.[0] || null);
                setClearClinicLogo(false);
              }}
            />
          </Button>
          {clinicLogo && <Typography variant="body2">{t('systemAdmin.logoSet')}</Typography>}
          <Button
            variant="text"
            onClick={() => {
              setClinicLogo('');
              setClearClinicLogo(true);
            }}
          >
            {t('systemAdmin.clearLogo')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" component="label">
            {t('systemAdmin.uploadAlertSound')}
            <input type="file" accept="audio/*" hidden onChange={(e) => setAlertSoundFile(e.target.files?.[0] || null)} />
          </Button>
          <Button variant="text" onClick={() => setAlertSoundUrl('')}>{t('systemAdmin.useDefaultAlert')}</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" component="label">
            {t('systemAdmin.uploadNotificationSound')}
            <input type="file" accept="audio/*" hidden onChange={(e) => setNotificationSoundFile(e.target.files?.[0] || null)} />
          </Button>
          <Button variant="text" onClick={() => setNotificationSoundUrl('')}>{t('systemAdmin.useDefaultNotification')}</Button>
        </Box>
        <Button variant="contained" onClick={handleUploadAssets}>
          {t('systemAdmin.assetsSave')}
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('systemAdmin.fullName')}</TableCell>
              <TableCell>{t('systemAdmin.username')}</TableCell>
              <TableCell>{t('systemAdmin.role')}</TableCell>
              <TableCell>{t('table.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>{u.username}</TableCell>
                <TableCell>{t(`roles.${u.role}`)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedUser(u);
                      setResetOpen(true);
                    }}
                  >
                    {t('password.reset')}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ ml: 1 }}
                    onClick={() => {
                      setSelectedUser(u);
                      setDeleteOpen(true);
                    }}
                  >
                    {t('systemAdmin.delete')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal de Criação */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('systemAdmin.newUser')}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label={t('systemAdmin.fullName')} {...register('fullName', { required: true })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label={t('systemAdmin.username')} {...register('username', { required: true })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth type="password" label={t('systemAdmin.password')} {...register('password', { required: true })} />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>{t('systemAdmin.role')}</InputLabel>
                  <Select label={t('systemAdmin.role')} defaultValue="" {...register('role', { required: true })}>
                    <MenuItem value="ADMIN">{t('roles.ADMIN')}</MenuItem>
                    <MenuItem value="ADMINISTRATIVO">{t('roles.ADMINISTRATIVO')}</MenuItem>
                    <MenuItem value="ENFERMEIRO">{t('roles.ENFERMEIRO')}</MenuItem>
                    <MenuItem value="MEDICO">{t('roles.MEDICO')}</MenuItem>
                    <MenuItem value="TEMPOS_ESPERA">{t('roles.TEMPOS_ESPERA')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained">{t('systemAdmin.create')}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('password.reset')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {selectedUser?.fullName} ({selectedUser?.username})
          </Typography>
          <TextField
            fullWidth
            type="password"
            label={t('password.new')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleResetPassword}>{t('password.reset')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('systemAdmin.delete')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('systemAdmin.deleteConfirm')}
          </Typography>
          <Typography variant="body2">
            {selectedUser?.fullName} ({selectedUser?.username})
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleDeleteUser}>
            {t('systemAdmin.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
