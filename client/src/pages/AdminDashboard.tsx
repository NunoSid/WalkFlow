import React from 'react';
import { useForm } from 'react-hook-form';
import { TextField, Button, Box, Typography, Paper, Grid, MenuItem } from '@mui/material';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { WaitTimesWidget } from '../components/WaitTimesWidget';
import { RecentList } from '../components/RecentList';
import { useTranslation } from 'react-i18next';
import { differenceInYears } from 'date-fns';

export const AdminDashboard = () => {
  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const dobValue = watch('dob');

  React.useEffect(() => {
    if (!dobValue) return;
    const date = new Date(dobValue);
    if (Number.isNaN(date.getTime())) return;
    const computedAge = differenceInYears(new Date(), date);
    if (computedAge >= 0) {
      setValue('age', computedAge);
    }
  }, [dobValue, setValue]);

  const onSubmit = async (data: any) => {
    try {
      await axios.post('/api/utentes', data);
      enqueueSnackbar(t('admin.success'), { variant: 'success' });
      reset();
    } catch (error: any) {
      const msg = error.response?.data?.error || t('admin.error');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  return (
    <Box>
        <WaitTimesWidget />
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>{t('admin.title')}</Typography>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('admin.name')}
              {...register('name', { required: t('admin.name') })}
              error={!!errors.name}
              helperText={errors.name?.message as string}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label={t('admin.process')}
              {...register('processNumber', { required: t('admin.process') })}
            />
          </Grid>
          <Grid item xs={12} md={3}>
             <TextField
              fullWidth
              type="date"
              label={t('admin.dob')}
              InputLabelProps={{ shrink: true }}
              {...register('dob')}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              fullWidth
              type="number"
              label={t('admin.age')}
              {...register('age')}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              select
              fullWidth
              label={t('admin.gender')}
              defaultValue=""
              {...register('gender')}
            >
              <MenuItem value="M">{t('admin.genderM')}</MenuItem>
              <MenuItem value="F">{t('admin.genderF')}</MenuItem>
              <MenuItem value="O">{t('admin.genderO')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('admin.contact')}
              {...register('contact')}
            />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" size="large">
              {t('admin.register')}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
    <RecentList />
    </Box>
  );
};
