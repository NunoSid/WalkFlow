import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSnackbar } from 'notistack';
import { useAuth } from './AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [alertSoundUrl, setAlertSoundUrl] = useState('/alert_beep.mp3');
  const [notificationSoundUrl, setNotificationSoundUrl] = useState('/notification.mp3');

  const alertBeepRef = useRef<HTMLAudioElement>(new Audio('/alert_beep.mp3'));
  const notificationSoundRef = useRef<HTMLAudioElement>(new Audio('/notification.mp3'));

  const playSound = (audio: HTMLAudioElement) => {
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch((error) => {
        console.error("Autoplay impedido pelo browser:", error);
        enqueueSnackbar(t('alerts.soundBlocked'), { variant: 'warning' });
      });
    }
  };

  const applySettings = (data: any) => {
    setAlertSoundUrl(data?.alertSoundUrl || '/alert_beep.mp3');
    setNotificationSoundUrl(data?.notificationSoundUrl || '/notification.mp3');
  };

  const isSettingsPayload = (data: any) => {
    if (!data || typeof data !== 'object') return false;
    return ('alertSoundUrl' in data || 'notificationSoundUrl' in data);
  };

  const refreshSettings = () => {
    axios.get('/api/settings/public')
      .then(({ data }) => applySettings(data))
      .catch(() => {});
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  useEffect(() => {
    alertBeepRef.current = new Audio(alertSoundUrl);
  }, [alertSoundUrl]);

  useEffect(() => {
    notificationSoundRef.current = new Audio(notificationSoundUrl);
  }, [notificationSoundUrl]);

  useEffect(() => {
    if (user) {
      const newSocket = io('/', {
        withCredentials: true,
        auth: {
          userId: user.id,
          role: user.role,
          username: user.username,
        }
      });
      setSocket(newSocket);

      // ALERTA PARA ENFERMEIRO: Novo Utente
      if (user.role === 'ENFERMEIRO' || user.role === 'ADMIN') {
        newSocket.on('new_utente', (data: any) => {
          console.log("Socket: Novo Utente recebido");
          enqueueSnackbar(data.message, { variant: 'info' });
          playSound(notificationSoundRef.current);
        });
      }

      // ALERTA PARA MÉDICO: Nova Avaliação
      if (user.role === 'MEDICO' || user.role === 'ADMIN') {
        newSocket.on('assessment_done', (data: any) => {
          console.log("Socket: Avaliação recebida", data);
          if (data.alertSound) {
            enqueueSnackbar(`${data.message}`, { variant: 'warning' });
            playSound(alertBeepRef.current);
          }
        });
      }

      newSocket.on('settings_updated', (data: any) => {
        if (isSettingsPayload(data)) applySettings(data);
        else refreshSettings();
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
