import axios from 'axios';
import { getImageFormat, loadLogoDataUrl } from './pdfLogo';

type ReportData = {
  utente: any;
  auditLogs: any[];
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

const formatVitals = (assessment: any, t: (key: string, options?: any) => string) => {
  if (!assessment) return '';
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
  if (assessment.waitingRoom) parts.push(`${t('nurse.waitingRoom')}: ${t(`waitingRooms.${assessment.waitingRoom}`, { defaultValue: assessment.waitingRoom })}`);
  return parts.join(' · ');
};

export const exportUtenteReportPdf = async (utenteId: string, t: (key: string, options?: any) => string) => {
  const [{ data: settings }, { data: report }] = await Promise.all([
    axios.get('/api/settings/public'),
    axios.get(`/api/utentes/${utenteId}/report`),
  ]);

  const clinicName = settings?.clinicName;
  const clinicLogo = settings?.clinicLogo;
  const showClinicLogo = settings?.showClinicLogo !== false;
  const showWalkflowLogo = settings?.showWalkflowLogo !== false;
  const reportData: ReportData = report;

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
  doc.text(t('report.title'), headerX, 40);
  if (clinicName) doc.text(clinicName, headerX, 58);

  const utente = reportData.utente;
  const preAssessmentEndLog = (reportData.auditLogs || []).find((log) =>
    log.action === 'UPDATE_STATUS' && String(log.details || '').includes('EM_ATENDIMENTO')
  );
  const preAssessmentStart = formatDate(utente.arrivalTime);
  const preAssessmentEnd = preAssessmentEndLog ? formatDate(preAssessmentEndLog.timestamp) : '';
  const infoRows = [
    [t('report.name'), utente.name || ''],
    [t('report.process'), utente.processNumber || ''],
    [t('report.arrival'), formatDate(utente.arrivalTime)],
    [t('report.status'), t(`statuses.${utente.status}`, { defaultValue: utente.status })],
    [t('report.triageStart'), formatDate(utente.triageStartAt)],
    [t('report.completedAt'), formatDate(utente.completedAt)],
    [
      t('report.preAssessmentPeriod'),
      `${preAssessmentStart}${preAssessmentEnd ? ` - ${preAssessmentEnd}` : ''}`,
    ],
  ];
  autoTable(doc, {
    head: [],
    body: infoRows,
    startY: 90,
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 170, fontStyle: 'bold' },
      1: { cellWidth: 330 },
    },
  });

  const assessmentHead = [[
    t('report.assessmentDate'),
    t('report.assessmentNurse'),
    t('report.assessmentColor'),
    t('report.assessmentNotes'),
    t('report.assessmentVitals'),
  ]];
  const assessmentBody = (utente.assessments || []).map((a: any) => [
    formatDate(a.createdAt),
    a.nurse?.fullName || a.nurse?.username || '',
    t(`colors.${a.color}`, { defaultValue: a.color }),
    a.observations || '',
    formatVitals(a, t),
  ]);
  const assessmentStart = (doc as any).lastAutoTable?.finalY
    ? (doc as any).lastAutoTable.finalY + 14
    : 210;
  autoTable(doc, { head: assessmentHead, body: assessmentBody, startY: assessmentStart, styles: { fontSize: 8 } });

  const nextStart = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 300;
  doc.setFontSize(11);
  doc.text(t('report.auditTitle'), 40, nextStart);

  const auditHead = [[t('report.auditDate'), t('report.auditUser'), t('report.auditAction'), t('report.auditDetails')]];
  const auditBody = (reportData.auditLogs || []).map((log) => [
    formatDate(log.timestamp),
    log.user?.fullName || log.user?.username || '',
    t(`audit.actions.${log.action}`, { defaultValue: log.action }),
    log.details || '',
  ]);
  autoTable(doc, { head: auditHead, body: auditBody, startY: nextStart + 12, styles: { fontSize: 8 } });

  const filename = `relatorio-utente-${utente.processNumber || utente.id}.pdf`;
  doc.save(filename);
};
