// ── Demo workspace seeder ───────────────────────────────────────────────────
//
// Creates a new workspace named "Daymark demo" and seeds it with realistic
// medcomms project management data — three projects at different stages,
// tasks linked to them, comms logs with various reply states.
//
// The workspace is marked as a demo via a flag stored in app_storage. The
// key format MUST start with `<user_id>:` to satisfy the personal_storage
// RLS policy on the app_storage table.

import { supabase } from './supabase.js';
import { createWorkspace } from './workspaces.js';
import { saveTask } from './tasks.js';
import { saveProject } from './projects.js';
import { uid } from './utils.js';

const DAY_MS = 86400000;
const daysFromNow = (n) => {
  const d = new Date(Date.now() + n * DAY_MS);
  return d.toISOString().slice(0, 10);
};
const isoNow = () => new Date().toISOString();
const isoDaysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString();

// ── Helpers ─────────────────────────────────────────────────────────────────
// Read user id from cached session (no network call, no auth-lock contention).
async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

// Key format must start with the user UUID to satisfy personal_storage RLS.
const demoFlagKey = (userId, workspaceId) =>
  `${userId}:demoWorkspace:${workspaceId}`;

// ── Demo metadata: read / write ────────────────────────────────────────────
export async function isDemoWorkspace(workspaceId) {
  if (!workspaceId) return false;

  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', demoFlagKey(userId, workspaceId))
    .maybeSingle();

  if (error) return false;
  return data?.value === 'true';
}

async function markAsDemo(workspaceId) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase.from('app_storage').upsert(
    {
      key: demoFlagKey(userId, worksspaceId),
      value: 'true',
      updated_at: isoNow(),
    },
    { onConflict: 'key' }
  );
  if (error) console.error('markasDemo failed:', error);
}

// ── The seeder ──────────────────────────────────────────────────────────────
export async function seedDemoWorkspace() {
  const ws = await createWorkspace('Daymark demo');
  await markAsDemo(ws.id);

  const projects = buildDemoProjects();
  for (const p of projects) {
    await saveProject(p, ws.id);
  }

  const tasks = buildDemoTasks(projects);
  for (const t of tasks) {
    await saveTask(t, ws.id);
  }

  return ws;
}

// ── Demo projects ──────────────────────────────────────────────────────────
function buildDemoProjects() {
  return [
    {
      id: uid(),
      name: 'Acme Pharma — Q4 Advisory Board',
      number: 'AP-2026-AB04',
      status: '🟡 At risk',
      nextSteps:
        'MLR feedback expected this week. Once approved, send pre-read to attendees by Friday.',
      blockers:
        'Awaiting medical lead sign-off on slide 12 (mechanism of action). Chased twice.',
      createdAt: Date.now() - 21 * DAY_MS,
      deliverables: [
        {
          id: uid(),
          name: 'Pre-read slide deck',
          stations: [
            {
              id: uid(),
              name: 'Draft 1',
              owner: 'Sarah K',
              done: true,
              completedAt: isoDaysAgo(14),
              targetDate: daysFromNow(-14),
              updatedAt: isoDaysAgo(14),
              notes: 'First draft based on previous Q3 deck structure.',
              comms: [],
            },
            {
              id: uid(),
              name: 'Internal review',
              owner: 'Sarah K',
              done: true,
              completedAt: isoDaysAgo(8),
              targetDate: daysFromNow(-10),
              updatedAt: isoDaysAgo(8),
              notes: 'Reviewed by medical writing lead. Minor edits to slides 4-7.',
              comms: [
                {
                  id: uid(),
                  type: 'Internal review',
                  sentAt: Date.now() - 12 * DAY_MS,
                  needsReply: true,
                  replyReceived: true,
                  replyAt: Date.now() - 8 * DAY_MS,
                  color: '#185FA5',
                },
              ],
            },
            {
              id: uid(),
              name: 'MLR review',
              owner: 'Sarah K',
              done: false,
              targetDate: daysFromNow(-2),
              updatedAt: isoDaysAgo(2),
              notes:
                'Submitted to MLR. Awaiting feedback. Medical lead flagged slide 12 may need revision.',
              comms: [
                {
                  id: uid(),
                  type: 'Client review request',
                  sentAt: Date.now() - 9 * DAY_MS,
                  needsReply: true,
                  replyReceived: false,
                  expectReplyBy: daysFromNow(-3),
                  color: '#D85A30',
                },
                {
                  id: uid(),
                  type: 'Chaser',
                  sentAt: Date.now() - 2 * DAY_MS,
                  needsReply: true,
                  replyReceived: false,
                  expectReplyBy: daysFromNow(1),
                  color: '#ef9f27',
                },
              ],
            },
            {
              id: uid(),
              name: 'Client approval',
              owner: 'Sarah K',
              done: false,
              targetDate: daysFromNow(5),
              comms: [],
            },
            {
              id: uid(),
              name: 'Send to attendees',
              owner: 'Sarah K',
              done: false,
              targetDate: daysFromNow(8),
              comms: [],
            },
          ],
        },
        {
          id: uid(),
          name: 'Discussion guide',
          stations: [
            {
              id: uid(),
              name: 'Draft 1',
              owner: 'James L',
              done: true,
              completedAt: isoDaysAgo(10),
              updatedAt: isoDaysAgo(10),
              comms: [],
            },
            {
              id: uid(),
              name: 'Internal review',
              owner: 'James L',
              done: true,
              completedAt: isoDaysAgo(5),
              updatedAt: isoDaysAgo(5),
              comms: [],
            },
            {
              id: uid(),
              name: 'Client review',
              owner: 'James L',
              done: false,
              targetDate: daysFromNow(2),
              updatedAt: isoDaysAgo(3),
              notes:
                'Sent to Anna at Acme. She mentioned she wants to add a chair intro section.',
              comms: [
                {
                  id: uid(),
                  type: 'Client review request',
                  sentAt: Date.now() - 3 * DAY_MS,
                  needsReply: true,
                  replyReceived: false,
                  expectReplyBy: daysFromNow(2),
                  color: '#D85A30',
                },
              ],
            },
            {
              id: uid(),
              name: 'Final',
              owner: 'James L',
              done: false,
              targetDate: daysFromNow(7),
              comms: [],
            },
          ],
        },
        {
          id: uid(),
          name: 'Post-meeting summary',
          stations: [
            {
              id: uid(),
              name: 'Draft 1',
              owner: 'Sarah K',
              done: false,
              targetDate: daysFromNow(15),
              comms: [],
            },
            {
              id: uid(),
              name: 'Internal review',
              owner: 'Sarah K',
              done: false,
              targetDate: daysFromNow(18),
              comms: [],
            },
            {
              id: uid(),
              name: 'Client sign-off',
              owner: 'Sarah K',
              done: false,
              targetDate: daysFromNow(22),
              comms: [],
            },
          ],
        },
      ],
      congresses: [],
    },
    {
      id: uid(),
      name: 'BetaCorp — Type 2 Diabetes Manuscript',
      number: 'BC-2026-MS01',
      status: '🟢 On track',
      nextSteps: 'Submitted to NEJM. Awaiting initial editorial decision (~6 weeks).',
      createdAt: Date.now() - 90 * DAY_MS,
      deliverables: [
        {
          id: uid(),
          name: 'Full manuscript',
          stations: [
            { id: uid(), name: 'Outline', done: true, completedAt: isoDaysAgo(75), comms: [] },
            { id: uid(), name: 'Draft 1', done: true, completedAt: isoDaysAgo(55), comms: [] },
            {
              id: uid(),
              name: 'Author review round 1',
              done: true,
              completedAt: isoDaysAgo(40),
              comms: [
                {
                  id: uid(),
                  type: 'Client review request',
                  sentAt: Date.now() - 50 * DAY_MS,
                  needsReply: true,
                  replyReceived: true,
                  replyAt: Date.now() - 42 * DAY_MS,
                  color: '#D85A30',
                },
              ],
            },
            {
              id: uid(),
              name: 'Author review round 2',
              done: true,
              completedAt: isoDaysAgo(20),
              comms: [
                {
                  id: uid(),
                  type: 'Client review request',
                  sentAt: Date.now() - 30 * DAY_MS,
                  needsReply: true,
                  replyReceived: true,
                  replyAt: Date.now() - 22 * DAY_MS,
                  color: '#D85A30',
                },
              ],
            },
            {
              id: uid(),
              name: 'Final approval',
              done: true,
              completedAt: isoDaysAgo(7),
              comms: [
                {
                  id: uid(),
                  type: 'Sign-off',
                  sentAt: Date.now() - 10 * DAY_MS,
                  needsReply: false,
                  replyReceived: true,
                  replyAt: Date.now() - 7 * DAY_MS,
                  color: '#639922',
                },
              ],
            },
            {
              id: uid(),
              name: 'Submitted to journal',
              done: true,
              completedAt: isoDaysAgo(3),
              updatedAt: isoDaysAgo(3),
              notes:
                'Submitted to NEJM. Confirmation email received. Tracking number: NEJM-2026-08214.',
              comms: [],
            },
          ],
        },
        {
          id: uid(),
          name: 'Cover letter',
          stations: [
            { id: uid(), name: 'Draft', done: true, completedAt: isoDaysAgo(8), comms: [] },
            { id: uid(), name: 'Lead author approval', done: true, completedAt: isoDaysAgo(4), comms: [] },
          ],
        },
      ],
      congresses: [],
    },
    {
      id: uid(),
      name: 'GammaCo — ASCO 2026 Symposium',
      number: 'GC-2026-ASCO',
      status: '🟢 On track',
      nextSteps:
        'Kick-off call with GammaCo team scheduled for Thursday. Need to draft initial scope document.',
      createdAt: Date.now() - 5 * DAY_MS,
      deliverables: [
        {
          id: uid(),
          name: 'Symposium concept',
          stations: [
            { id: uid(), name: 'Initial brief', done: false, targetDate: daysFromNow(7), comms: [] },
            { id: uid(), name: 'Concept proposal', done: false, targetDate: daysFromNow(14), comms: [] },
            { id: uid(), name: 'Client approval', done: false, targetDate: daysFromNow(21), comms: [] },
          ],
        },
      ],
      congresses: [],
    },
  ];
}

// ── Demo tasks ──────────────────────────────────────────────────────────────
function buildDemoTasks(projects) {
  const acme = projects[0];
  const beta = projects[1];
  const gamma = projects[2];

  const acmeMlr = acme.deliverables[0].stations.find((s) => s.name === 'MLR review');
  const acmeClientReview = acme.deliverables[1].stations.find((s) => s.name === 'Client review');
  const gammaBrief = gamma.deliverables[0].stations.find((s) => s.name === 'Initial brief');

  const baseTask = (overrides) => ({
    id: uid(),
    title: '',
    priority: 'Medium',
    category: '',
    project: '',
    status: 'To do',
    done: false,
    due: '',
    dueDate: '',
    reminder: '',
    tags: [],
    recurring: 'none',
    taskNumber: '',
    expenditureType: '',
    links: [],
    stationId: null,
    checklistProgress: {},
    createdAt: Date.now(),
    doneAt: null,
    estimate: null,
    outOfScope: false,
    outOfScopeHours: null,
    outOfScopeNotes: '',
    ...overrides,
  });

  return [
    baseTask({
      title: 'Chase Acme medical lead on slide 12 sign-off',
      project: acme.name,
      priority: 'High',
      dueDate: daysFromNow(-2),
      stationId: acmeMlr?.id || null,
      estimate: 0.5,
    }),
    baseTask({
      title: "Incorporate Anna's feedback on discussion guide",
      project: acme.name,
      priority: 'High',
      dueDate: daysFromNow(0),
      stationId: acmeClientReview?.id || null,
      estimate: 2,
    }),
    baseTask({
      title: 'Kick-off call prep for GammaCo',
      project: gamma.name,
      priority: 'High',
      dueDate: daysFromNow(0),
      stationId: gammaBrief?.id || null,
      estimate: 1,
    }),
    baseTask({
      title: 'Update Acme attendee list with confirmed responses',
      project: acme.name,
      priority: 'Medium',
      dueDate: daysFromNow(2),
      estimate: 0.5,
    }),
    baseTask({
      title: 'Draft scope document for GammaCo ASCO symposium',
      project: gamma.name,
      priority: 'Medium',
      dueDate: daysFromNow(3),
      stationId: gammaBrief?.id || null,
      estimate: 4,
    }),
    baseTask({
      title: 'Q4 forecast update for finance team',
      priority: 'Medium',
      dueDate: daysFromNow(4),
      estimate: 1,
    }),
    baseTask({
      title: 'Weekly status round update',
      priority: 'Medium',
      dueDate: daysFromNow(2),
      recurring: 'weekly',
      estimate: 0.5,
    }),
    baseTask({
      title: 'Add 4 extra slides to Acme deck (MoA deep-dive)',
      project: acme.name,
      priority: 'Medium',
      dueDate: daysFromNow(5),
      stationId: acmeMlr?.id || null,
      estimate: 3,
      outOfScope: true,
      outOfScopeHours: 3,
      outOfScopeNotes:
        "Original SoW didn't include MoA section. Flagged to account lead for scope discussion.",
    }),
    baseTask({
      title: 'Send BetaCorp manuscript to NEJM',
      project: beta.name,
      priority: 'High',
      dueDate: daysFromNow(-3),
      done: true,
      doneAt: isoDaysAgo(3),
      estimate: 1,
    }),
    baseTask({
      title: 'Confirm BetaCorp authors with final manuscript version',
      project: beta.name,
      priority: 'Medium',
      dueDate: daysFromNow(-7),
      done: true,
      doneAt: isoDaysAgo(7),
      estimate: 0.5,
    }),
  ];
}
