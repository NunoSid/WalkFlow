import { Request, Response } from 'express';
import prisma from '../prisma';
import { getIO } from '../socket';

const SETTINGS_KEYS = ['clinicName', 'clinicLogo', 'showClinicLogo', 'showWalkflowLogo', 'alertSoundUrl', 'notificationSoundUrl'];

const loadPublicSettings = async () => {
  const settings = await prisma.setting.findMany({
    where: { key: { in: SETTINGS_KEYS } },
  });
  const map = settings.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
  return {
    clinicName: map.clinicName || '',
    clinicLogo: map.clinicLogo || '',
    showClinicLogo: map.showClinicLogo !== 'false',
    showWalkflowLogo: map.showWalkflowLogo !== 'false',
    alertSoundUrl: map.alertSoundUrl || '',
    notificationSoundUrl: map.notificationSoundUrl || '',
  };
};

export const getPublicSettings = async (_req: Request, res: Response) => {
  try {
    const publicSettings = await loadPublicSettings();
    res.json(publicSettings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
};

export const updateClinicName = async (req: Request, res: Response) => {
  const { clinicName } = req.body;
  if (!clinicName || typeof clinicName !== 'string') {
    return res.status(400).json({ error: 'Nome inválido.' });
  }
  try {
    await prisma.setting.upsert({
      where: { key: 'clinicName' },
      update: { value: clinicName },
      create: { key: 'clinicName', value: clinicName },
    });
    getIO().emit('settings_updated', { refresh: true });
    res.json({ message: 'Nome atualizado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar nome.' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  const {
    clinicName,
    clinicLogo,
    showClinicLogo,
    showWalkflowLogo,
    alertSoundUrl,
    notificationSoundUrl,
  } = req.body || {};

  const updates: Record<string, string> = {};
  if (typeof clinicName === 'string') updates.clinicName = clinicName;
  if (typeof clinicLogo === 'string') updates.clinicLogo = clinicLogo;
  if (typeof showClinicLogo === 'boolean') updates.showClinicLogo = String(showClinicLogo);
  if (typeof showWalkflowLogo === 'boolean') updates.showWalkflowLogo = String(showWalkflowLogo);
  if (typeof alertSoundUrl === 'string') updates.alertSoundUrl = alertSoundUrl;
  if (typeof notificationSoundUrl === 'string') updates.notificationSoundUrl = notificationSoundUrl;

  try {
    await Promise.all(Object.entries(updates).map(([key, value]) => (
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )));
    getIO().emit('settings_updated', { refresh: true });
    res.json({ message: 'Configurações atualizadas.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações.' });
  }
};
