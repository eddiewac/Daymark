// â”€â”€ Demo workspace seeder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Creates a new workspace named "Daymark demo" and seeds it with realistic
// medcomms project management data â€” three projects at different stages,
// tasks linked to them, comms logs with various reply states, time entries.
//
// The workspace is marked as a demo via a small flag stored in app_storage
// (key `ws-meta:{workspaceId}:isDemo`), which the banner reads to decide
// whether to show.
//
// Users can delete the demo workspace at any time via the standard workspace
// delete flow â€” there's no special handling required.

import { supabase } from './supabase.js';
import { createWorkspace } from './workspaces.js';
import { saveTask } from './tasks.js';
import { saveProject } from './projects.js';
import { uid } from './utils.js';

// Days from today, helpers for generating realistic relative dates.
const DAY_MS = 86400000;
const today = () => new Date();
const daysFromNow = (n) => {
  const d = new Date(Date.now() + n * DAY_MS);
  return d.toISOString().slice(0, 10);
};
const isoNow = () => new Date().toISOString();
const isoDaysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString();

// â”€â”€ Demo metadata helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const demoFlagKey = (workspaceId) => `ws-meta:${workspaceId}:isDemo`;

export async function isDemoWorkspace(workspaceId) {
  if (!workspaceId) return false;
  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', demoFlagKey(workspaceId))
    .maybeSingle();
  if (error) return false;
  return data?.value === 'true';
}

async function markAsDemo(workspaceId) {
  await supabase.from('app_storage').upsert(
    {
      key: demoFlagKey(workspaceId),
      value: 'true',
      updated_at: isoNow(),
    },
    { onConflict: 'key' }
  );
}

// â”€â”€ The seeder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function seedDemoWorkspace() {
  // 1. Create the workspace
  const ws = await createWorkspace('Daymark demo');

  // 2. Mark it as a demo
  await markAsDemo(ws.id);

  // 3. Build the projects and their nested deliverables/stations/comms
  const projects = buildDemoProjects();

  // 4. Save projects to the workspace
  for (const p of projects) {
    await saveProject(p, ws.id);
  }

  // 5. Build standalone + project-linked tasks
  const tasks = buildDemoTasks(projects);

  for (const t of tasks) {
    await saveTask(t, ws.id);
  }

  return ws;
}

// â”€â”€ Demo projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildDemoProjects() {
  return [
    // Project 1: Active mid-stream Advisory Board
    {
      id: uid(),
      name: 'Acme Pharma â€” Q4 Advisory Board',
      number: 'AP-2026-AB04',
      status: 'ðŸŸ¡ At risk',
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
              notes: 'Sent to Anna at Acme. She mentioned she wants to add a chair intro section.',
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

    // Project 2: Nearly done Manuscript
    {
      id: uid(),
      name: 'BetaCorp â€” Type 2 Diabetes Manuscript',
      number: 'BC-2026-MS01',
      status: 'ðŸŸ¢ On track',
      nextSteps: 'Submitted to NEJM. Awaiting initial editorial decision (~6 weeks).',
      createdAt: Date.now() - 90 * DAY_MS,
      deliverables: [
        {
          id: uid(),
          name: 'Full manuscript',
          stations: [
            {
              id: uid(),
              name: 'Outline',
              done: true,
              completedAt: isoDaysAgo(75),
              comms: [],
            },
            {
              id: uid(),
              name: 'Draft 1',
              done: true,
              completedAt: isoDaysAgo(55),
              comms: [],
            },
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
              notes: 'Submitted to NEJM. Confirmation email received. Tracking number: NEJM-2026-08214.',
              comms: [],
            },
          ],
        },
        {
          id: uid(),
          name: 'Cover letter',
          stations: [
            {
              id: uid(),
              name: 'Draft',
              done: true,
              completedAt: isoDaysAgo(8),
              comms: [],
            },
            {
              id: uid(),
              name: 'Lead author approval',
              done: true,
              completedAt: isoDaysAgo(4),
              comms: [],
            },
          ],
        },
      ],
      congresses: [],
    },

    // Project 3: Fresh, just kicking off
    {
      id: uid(),
      name: 'GammaCo â€” ASCO 2026 Symposium',
      number: 'GC-2026-ASCO',
      status: 'ðŸŸ¢ On track',
      nextSteps: 'Kick-off call with GammaCo team scheduled for Thursday. Need to draft initial scope document.',
      createdAt: Date.now() - 5 * DAY_MS,
      deliverables: [
        {
          id: uid(),
          name: 'Symposium concept',
          stations: [
            {
              id: uid(),
              name: 'Initial brief',
              done: false,
              targetDate: daysFromNow(7),
              comms: [],
            },
            {
              id: uid(),
              name: 'Concept proposal',
              done: false,
              targetDate: daysFromNow(14),
              comms: [],
            },
            {
              id: uid(),
              name: 'Client approval',
              done: false,
              targetDate: daysFromNow(21),
              comms: [],
            },
          ],
        },
      ],
      congresses: [],
    },
  ];
}

// â”€â”€ Demo tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildDemoTasks(projects) {
  const acme = projects[0];
  const beta = projects[1];
  const gamma = projects[2];

  // Find specific stations to link tasks to, for richness
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
    // Overdue (deliberately â€” to demonstrate the overdue surfacing)
    baseTask({
      title: 'Chase Acme medical lead on slide 12 sign-off',
      project: acme.name,
      priority: 'High',
      dueDate: daysFromNow(-2),
      stationId: acmeMlr?.id || null,
      estimate: 0.5,
    }),

    // Due today â€” important
    baseTask({
      title: 'Incorporate Anna\'s feedback on discussion guide',
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

    // Due this week
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

    // Recurring weekly task
    baseTask({
      title: 'Weekly status round update',
      priority: 'Medium',
      dueDate: daysFromNow(2),
      recurring: 'weekly',
      estimate: 0.5,
    }),

    // Out of scope flagged item
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
        'Original SoW didn\'t include MoA section. Flagged to account lead for scope discussion.',
    }),

    // Already done â€” to show what completed tasks look like
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
