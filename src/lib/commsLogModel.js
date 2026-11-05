// Comms Log is metadata: type, when, author, where it sits, an optional
// external URL, and an optional short label. There is no message body.
//
// Chase entries also write a station `comms` row with the same id so Today ·
// Waiting keeps using needsReply / replyReceived. Call and decision stay in
// the log only. Older station comms that were never written to the table are
// surfaced here so the trail stays one list.

import { uid } from './utils.js';

export const LABEL_MAX = 80;
export const URL_MAX = 500;

export const EMPTY_COMMS_LOG =
  'Log a chase, call or decision — link out to Teams/Slack if the conversation lives there.';

export const COMM_TYPES = [
  { id: 'chase', label: 'Chase', button: 'Log chase' },
  { id: 'call', label: 'Call', button: 'Log call' },
  { id: 'decision', label: 'Decision', button: 'Log decision' },
];

const TYPE_IDS = new Set(COMM_TYPES.map((t) => t.id));

export function isCommsType(type) {
  return TYPE_IDS.has(type);
}

export function typeLabel(type) {
  const known = COMM_TYPES.find((t) => t.id === type);
  return known ? known.label : (type || 'Comm');
}

// One line, hard length cap. Newlines cannot smuggle a message body into the label.
export function sanitizeLabel(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LABEL_MAX);
}

// http(s) only. A bare host is treated as https. Anything else is rejected.
export function sanitizeUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: true, url: '' };
  if (/\s/.test(text)) return { ok: false, error: 'Link can’t contain spaces' };
  let url = text;
  if (!/^https?:\/\//i.test(url)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return { ok: false, error: 'Use an http or https link' };
    }
    url = `https://${url}`;
  }
  if (url.length > URL_MAX) return { ok: false, error: 'Link is too long' };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'That link doesn’t look valid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Use an http or https link' };
  }
  return { ok: true, url: parsed.href };
}

// Shared id for a chase so the log row and the Waiting row cannot drift apart.
export function prepareCommsLogEntry({
  type,
  label,
  url,
  project,
  deliverable,
  station,
  id,
  at,
  expectReplyBy,
}) {
  if (!isCommsType(type)) return { ok: false, error: 'Pick chase, call, or decision' };
  const cleanUrl = sanitizeUrl(url);
  if (!cleanUrl.ok) return cleanUrl;
  const entry = {
    id: id || uid(),
    projectId: project?.id || '',
    deliverableId: deliverable?.id || '',
    stationId: station?.id || '',
    type,
    at: at || new Date().toISOString(),
    url: cleanUrl.url,
    label: sanitizeLabel(label),
  };
  const stationComm = type === 'chase'
    ? {
        id: entry.id,
        type: 'Chase',
        needsReply: true,
        sentAt: Date.parse(entry.at) || Date.now(),
        replyReceived: false,
        replyAt: null,
        expectReplyBy: expectReplyBy || null,
        // Waiting reads who for “awaiting …”. Only when a short label was set.
        ...(entry.label ? { who: entry.label } : {}),
      }
    : null;
  return { ok: true, entry, stationComm };
}

export function authorLabel(authorId, { currentUserId, members } = {}) {
  if (!authorId) return '';
  if (currentUserId && authorId === currentUserId) return 'You';
  const member = (members || []).find((m) => m && (m.id === authorId || m.user_id === authorId));
  const email = (member?.email || '').trim();
  if (!email) return 'Teammate';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

export function filterCommsEntries(entries, { projectId, stationId } = {}) {
  return (entries || []).filter((entry) => {
    if (projectId && entry.projectId !== projectId) return false;
    if (stationId && entry.stationId !== stationId) return false;
    return true;
  });
}

function indexProjects(projects) {
  const byStation = new Map();
  const byProject = new Map();
  for (const project of projects || []) {
    if (!project?.id) continue;
    byProject.set(project.id, project);
    for (const deliverable of project.deliverables || []) {
      for (const station of deliverable.stations || []) {
        if (station?.id) byStation.set(station.id, { project, deliverable, station });
      }
    }
  }
  return { byStation, byProject };
}

function placeFor(row, index) {
  if (row.stationId && index.byStation.has(row.stationId)) {
    return index.byStation.get(row.stationId);
  }
  const project = row.projectId ? index.byProject.get(row.projectId) || null : null;
  if (!project) return { project: null, deliverable: null, station: null };
  const deliverable = row.deliverableId
    ? (project.deliverables || []).find((d) => d.id === row.deliverableId) || null
    : null;
  const station = deliverable && row.stationId
    ? (deliverable.stations || []).find((s) => s.id === row.stationId) || null
    : null;
  return { project, deliverable, station };
}

function commTime(comm) {
  const raw = comm?.sentAt ?? comm?.at ?? comm?.ts ?? null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const ms = Date.parse(raw || '');
  return Number.isFinite(ms) ? ms : 0;
}

function safeUrl(raw) {
  const clean = sanitizeUrl(raw || '');
  return clean.ok ? clean.url : '';
}

function viewBase(id, place) {
  return {
    id,
    projectId: place.project?.id || '',
    deliverableId: place.deliverable?.id || '',
    stationId: place.station?.id || '',
    projectName: place.project?.name || '',
    deliverableName: place.deliverable?.name || '',
    stationName: place.station?.name || '',
  };
}

function viewFromLog(row, place, stationComm) {
  const atMs = Date.parse(row.at || '') || 0;
  return {
    ...viewBase(row.id, place),
    projectId: row.projectId || place.project?.id || '',
    deliverableId: row.deliverableId || place.deliverable?.id || '',
    stationId: row.stationId || place.station?.id || '',
    type: row.type,
    authorId: row.authorId || '',
    at: row.at || '',
    atMs,
    url: safeUrl(row.url),
    label: sanitizeLabel(row.label),
    needsReply: !!(stationComm && stationComm.needsReply),
    replyReceived: !!(stationComm && stationComm.replyReceived),
    expectReplyBy: (stationComm && stationComm.expectReplyBy) || '',
    source: 'log',
  };
}

function viewFromStation(comm, place, id) {
  const atMs = commTime(comm);
  return {
    ...viewBase(id, place),
    type: comm?.type || 'Comm',
    authorId: '',
    at: atMs ? new Date(atMs).toISOString() : '',
    atMs,
    url: safeUrl(comm?.url),
    label: '',
    needsReply: !!comm?.needsReply,
    replyReceived: !!comm?.replyReceived,
    expectReplyBy: comm?.expectReplyBy || '',
    source: 'station',
  };
}

// Log rows win when the id matches a station comm (the chase dual-write).
// Station comms with no log row are still listed. Notes are never copied.
export function mergeCommsLog(rows, projects) {
  const index = indexProjects(projects);
  const seen = new Set();
  const out = [];

  for (const row of rows || []) {
    if (!row?.id || seen.has(row.id)) continue;
    const place = placeFor(row, index);
    const stationComm = (place.station?.comms || []).find((c) => c && c.id === row.id) || null;
    seen.add(row.id);
    out.push(viewFromLog(row, place, stationComm));
  }

  for (const project of projects || []) {
    for (const deliverable of project?.deliverables || []) {
      for (const station of deliverable?.stations || []) {
        (station.comms || []).forEach((comm, i) => {
          const id = comm?.id
            ? String(comm.id)
            : `station:${station.id}:${comm?.sentAt || i}:${comm?.type || 'comm'}`;
          if (seen.has(id)) return;
          seen.add(id);
          out.push(viewFromStation(comm, { project, deliverable, station }, id));
        });
      }
    }
  }

  out.sort((a, b) => (b.atMs - a.atMs) || String(a.id).localeCompare(String(b.id)));
  return out;
}
