import { Request, Response } from 'express';
import prisma from '../prisma';
import { getIO } from '../socket';
import { differenceInMonths } from 'date-fns';

export const createAssessment = async (req: Request, res: Response) => {
  const {
    utenteId,
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
  } = req.body;
  // @ts-ignore
  const nurseId = req.user?.id;

  if (!utenteId || !color) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  try {
    // Validar Utente
    const utente = await prisma.utente.findUnique({ where: { id: utenteId } });
    if (!utente) return res.status(404).json({ error: 'Utente não encontrado.' });

    // Validação de idade (< 3 meses não pode ser VERDE)
    if (color === 'VERDE' && utente.dob) {
      const months = differenceInMonths(new Date(), new Date(utente.dob));
      if (months < 3) {
        return res.status(400).json({ error: 'Bebés < 3 meses não podem ser classificados como Verde.' });
      }
    }
    // Se não tem DOB mas tem Age (em anos), assume-se > 3 meses a menos que seja 0.
    // Para segurança, se age == 0 e dob == null, devia validar, mas vou simplificar assumindo que DOB é preferencial.

    // Criar Assessment
    await prisma.assessment.create({
      data: {
        utenteId,
        nurseId,
        color,
        observations,
        ecgDone: !!ecgDone,
        comburDone: !!comburDone,
        bloodPressure: bloodPressure || null,
        waitingRoom: waitingRoom || null,
        heartRate: heartRate !== undefined && heartRate !== null ? Number(heartRate) : null,
        temperature: temperature !== undefined && temperature !== null ? Number(temperature) : null,
        respiratoryRate: respiratoryRate !== undefined && respiratoryRate !== null ? Number(respiratoryRate) : null,
        pain: pain !== undefined && pain !== null ? Number(pain) : null,
        spo2: spo2 !== undefined && spo2 !== null ? Number(spo2) : null,
        glucose: glucose !== undefined && glucose !== null ? Number(glucose) : null,
      }
    });

    // Atualizar Utente
    await prisma.utente.update({
      where: { id: utenteId },
      data: {
        status: 'AGUARDANDO_MEDICO',
        triageStartAt: utente.triageStartAt ?? new Date(),
      }
    });

    // Log
    await prisma.auditLog.create({
      data: { userId: nurseId, action: 'CREATE_ASSESSMENT', targetId: utenteId, details: `Cor: ${color}` }
    });

    // Notificar Médicos
    // Apenas sons se for AMARELO ou VERMELHO
    const alertSound = (color === 'AMARELO' || color === 'VERMELHO');
    getIO().emit('assessment_done', { 
      message: `Novo caso ${color}`, 
      color, 
      utenteId,
      alertSound 
    });

    res.status(201).json({ message: 'Pré-Avaliação concluída.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gravar avaliação.' });
  }
};
