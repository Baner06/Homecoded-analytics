export const TIMEZONE = 'America/Bogota';

export function getDateISOInColombia(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

export function formatDateLongColombia(date = new Date()) {
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  const day = get('day');
  const month = get('month').toLowerCase();
  const year = get('year');
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return `${cap(weekday)}, ${day} de ${month} de ${year}`;
}

export function formatKickoffColombia(isoUtc) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoUtc));
}

export function isSameDayColombia(isoUtc, dateIso) {
  return getDateISOInColombia(new Date(isoUtc)) === dateIso;
}

export function addDaysToDateIso(dateIso, days) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isTodayDateIso(dateIso) {
  return dateIso === getDateISOInColombia();
}
