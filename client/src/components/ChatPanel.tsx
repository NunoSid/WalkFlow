import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from 'react-i18next';

type ChatPanelProps = {
  open: boolean;
  onClose: () => void;
  unreadByTarget?: Record<string, number>;
  onReadTarget?: (key: string) => void;
  onActiveTargetChange?: (key: string | null) => void;
};

type ChatThread = {
  threadKey: string;
  type: 'USER' | 'ROLE' | 'ALL';
  label: string;
  role?: string | null;
  user?: any | null;
  archived?: boolean;
  lastMessage?: { message: string; createdAt: string; fromUserId: string };
};

export const ChatPanel = ({ open, onClose, unreadByTarget, onReadTarget, onActiveTargetChange }: ChatPanelProps) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { t } = useTranslation();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newUserId, setNewUserId] = useState('');

  const roles = useMemo(() => ['ADMINISTRATIVO', 'ENFERMEIRO', 'MEDICO', 'ADMIN'], []);

  const getThreadKeyForMessage = (msg: any) => {
    if (msg?.toUserId) {
      const otherId = msg.fromUserId === user?.id ? msg.toUserId : msg.fromUserId;
      return `USER:${otherId}`;
    }
    if (msg?.toRole) return `ROLE:${msg.toRole}`;
    return 'ROLE:ALL';
  };

  const getUnreadCount = (key: string) => (unreadByTarget?.[key] || 0);

  const refreshThreads = async () => {
    const { data } = await axios.get('/api/chat/threads');
    setThreads(Array.isArray(data) ? data : []);
  };

  const refreshMessages = async (threadKey: string) => {
    const { data } = await axios.get('/api/chat/messages', { params: { threadKey } });
    setMessages(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!open) {
      onActiveTargetChange?.(null);
      return;
    }
    const load = async () => {
      const [userRes] = await Promise.all([
        axios.get('/api/auth/directory'),
        refreshThreads(),
      ]);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
    };
    load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const visibleThreads = threads.filter((thread) => !!thread.archived === showArchived);
    if (!activeThreadKey && visibleThreads.length) {
      setActiveThreadKey(visibleThreads[0].threadKey);
    }
  }, [threads, open, showArchived, activeThreadKey]);

  useEffect(() => {
    if (!open || !activeThreadKey) return;
    onActiveTargetChange?.(activeThreadKey);
    onReadTarget?.(activeThreadKey);
    refreshMessages(activeThreadKey);
  }, [activeThreadKey, open, onActiveTargetChange, onReadTarget]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: any) => {
      const threadKey = getThreadKeyForMessage(msg);
      if (threadKey === activeThreadKey) {
        setMessages((prev) => [...prev, msg]);
        onReadTarget?.(threadKey);
      }
      refreshThreads();
    };
    socket.on('chat_message', handler);
    return () => {
      socket.off('chat_message', handler);
    };
  }, [socket, activeThreadKey, onReadTarget]);

  const pendingUserThread = useMemo(() => {
    if (!newUserId) return null;
    const userData = users.find((u) => u.id === newUserId);
    if (!userData) return null;
    return {
      threadKey: `USER:${userData.id}`,
      type: 'USER' as const,
      label: userData.fullName || userData.username,
      user: userData,
      archived: false,
    };
  }, [newUserId, users]);

  const channelThreads = useMemo(() => ([
    { threadKey: 'ROLE:ALL', type: 'ALL' as const, label: t('chat.global') },
    ...roles.map((role) => ({
      threadKey: `ROLE:${role}`,
      type: 'ROLE' as const,
      label: t(`roles.${role}`),
      role,
    })),
  ]), [roles, t]);

  const visibleThreads = threads.filter((thread) => !!thread.archived === showArchived);
  const threadMap = useMemo(() => {
    const map = new Map<string, ChatThread>();
    visibleThreads.forEach((thread) => map.set(thread.threadKey, thread));
    if (pendingUserThread) {
      map.set(pendingUserThread.threadKey, pendingUserThread);
    }
    if (!showArchived) {
      channelThreads.forEach((thread) => {
        if (!map.has(thread.threadKey)) {
          map.set(thread.threadKey, thread);
        }
      });
    }
    return map;
  }, [visibleThreads, pendingUserThread, channelThreads, showArchived]);

  const directThreads = Array.from(threadMap.values()).filter((thread) => thread.type === 'USER');
  const channelList = Array.from(threadMap.values()).filter((thread) => thread.type !== 'USER');

  const activeThread = threadMap.get(activeThreadKey || '');
  const getThreadLabel = (thread?: ChatThread | null) => {
    if (!thread) return '';
    if (thread.type === 'ALL') return t('chat.global');
    if (thread.type === 'ROLE') {
      const role = thread.role || thread.threadKey.replace('ROLE:', '');
      return t(`roles.${role}`);
    }
    return thread.label;
  };

  const handleSend = () => {
    const content = text.trim();
    if (!content || !socket || !user || !activeThread) return;

    const payload: any = { message: content, fromUserId: user.id };
    if (activeThread.type === 'USER') {
      payload.toUserId = activeThread.threadKey.replace('USER:', '');
    } else if (activeThread.type === 'ROLE') {
      payload.toRole = activeThread.threadKey.replace('ROLE:', '');
    } else {
      payload.toRole = 'ALL';
    }
    socket.emit('chat_message', payload);
    setText('');
  };

  const handleArchive = async (threadKey: string, archived: boolean) => {
    await axios.patch(`/api/chat/threads/${encodeURIComponent(threadKey)}/archive`, { archived });
    refreshThreads();
    if (!archived && showArchived) {
      setActiveThreadKey(null);
    }
  };

  const handleDelete = async (threadKey: string) => {
    await axios.delete(`/api/chat/threads/${encodeURIComponent(threadKey)}`);
    if (activeThreadKey === threadKey) {
      setActiveThreadKey(null);
      setMessages([]);
    }
    refreshThreads();
  };

  const formatTime = (value?: string) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('chat.title')}
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, minHeight: 480 }}>
          <Box sx={{ width: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Tabs
              value={showArchived ? 'archived' : 'inbox'}
              onChange={(_, value) => setShowArchived(value === 'archived')}
              variant="fullWidth"
            >
              <Tab value="inbox" label={t('chat.inbox')} />
              <Tab value="archived" label={t('chat.archived')} />
            </Tabs>

            {!showArchived && (
              <Select
                size="small"
                displayEmpty
                value={newUserId}
                onChange={(event) => {
                  const selected = event.target.value as string;
                  setNewUserId(selected);
                  if (selected) {
                    const key = `USER:${selected}`;
                    setActiveThreadKey(key);
                    onReadTarget?.(key);
                  }
                }}
              >
                <MenuItem value="">{t('chat.newDirect')}</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName || u.username} · {t(`roles.${u.role}`)}
                  </MenuItem>
                ))}
              </Select>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Typography variant="caption" color="text.secondary">
                {t('chat.directThreads')}
              </Typography>
              <List dense>
                {directThreads.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
                    {t('chat.noThreads')}
                  </Typography>
                )}
                {directThreads.map((thread) => (
                  <ListItemButton
                    key={thread.threadKey}
                    selected={activeThreadKey === thread.threadKey}
                    onClick={() => setActiveThreadKey(thread.threadKey)}
                  >
                    <ListItemText
                      primary={getThreadLabel(thread)}
                      secondary={thread.lastMessage?.message || ''}
                      primaryTypographyProps={{ noWrap: true }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                    {!!getUnreadCount(thread.threadKey) && (
                      <Chip size="small" color="error" label={getUnreadCount(thread.threadKey)} />
                    )}
                  </ListItemButton>
                ))}
              </List>

              <Divider sx={{ my: 1 }} />

              <Typography variant="caption" color="text.secondary">
                {t('chat.channels')}
              </Typography>
              <List dense>
                {channelList.map((thread) => (
                  <ListItemButton
                    key={thread.threadKey}
                    selected={activeThreadKey === thread.threadKey}
                    onClick={() => setActiveThreadKey(thread.threadKey)}
                  >
                    <ListItemText
                      primary={getThreadLabel(thread)}
                      secondary={thread.lastMessage?.message || ''}
                      primaryTypographyProps={{ noWrap: true }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                    {!!getUnreadCount(thread.threadKey) && (
                      <Chip size="small" color="error" label={getUnreadCount(thread.threadKey)} />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Box>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="subtitle1">
                  {getThreadLabel(activeThread) || t('chat.selectThread')}
                </Typography>
                {activeThread?.lastMessage && (
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(activeThread.lastMessage.createdAt)}
                  </Typography>
                )}
              </Box>
              {activeThread && (
                <Stack direction="row" spacing={1}>
                  <Tooltip title={activeThread.archived ? t('chat.unarchive') : t('chat.archive')}>
                    <IconButton
                      size="small"
                      onClick={() => handleArchive(activeThread.threadKey, !activeThread.archived)}
                    >
                      {activeThread.archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('chat.delete')}>
                    <IconButton size="small" color="error" onClick={() => handleDelete(activeThread.threadKey)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Box>

            <Box sx={{ border: '1px solid #e0e7ef', borderRadius: 2, p: 2, flex: 1, overflowY: 'auto', mb: 2 }}>
              {messages.length === 0 && (
                <Typography variant="body2" color="text.secondary">{t('chat.emptyThread')}</Typography>
              )}
              {messages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    mb: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: m.fromUserId === user?.id ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {(m.fromUser?.fullName || m.fromUser?.username) ?? '—'} · {formatTime(m.createdAt)}
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: m.fromUserId === user?.id ? '#d9ecff' : '#f3f4f6',
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      maxWidth: '75%',
                    }}
                  >
                    <Typography variant="body2">{m.message}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={activeThread ? t('chat.placeholder') : t('chat.selectThread')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!activeThread}
              />
              <Button variant="contained" onClick={handleSend} disabled={!activeThread}>
                {t('chat.send')}
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
