// Personal Today Do keeps a station on Open project. Run with:
//   npx --yes esbuild src/components/today/openProjectTarget.check.js --bundle --platform=node --format=cjs --outfile=/tmp/open-project-target-check.cjs && node /tmp/open-project-target-check.cjs
import { todayProjectOpenTarget } from './openProjectTarget.js';

function station(id, done) {
  return { id, name: id, done: !!done };
}

function deliverable(id, stations) {
  return { id, name: id, stations };
}

const projects = [
  {
    id: 'p-personal',
    name: 'Desk project',
    deliverables: [
      deliverable('d-done', [station('s-done', true)]),
      deliverable('d-live', [station('s-live', false), station('s-next', false)]),
    ],
  },
];

// Same fall-through as WorkspaceView.openRecord: overlay only when the
// station id is on a loaded deliverable; otherwise the Projects grid.
function land(projectsList, target) {
  const spec = typeof target === 'string' ? { projectId: target } : target;
  if (!spec?.projectId) return 'grid';
  if (spec.stationId) {
    for (const p of projectsList || []) {
      if (p.id !== spec.projectId) continue;
      for (const d of p.deliverables || []) {
        if (spec.deliverableId && d.id !== spec.deliverableId) continue;
        if ((d.stations || []).some((s) => s.id === spec.stationId)) return 'workbench';
      }
    }
  }
  return 'grid';
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

// contextForTask stops on the finished deliverable and returns no station.
// The click must still carry stationId so the workbench opens.
const personalDo = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: {
    id: 't-do',
    projectId: 'p-personal',
    project: 'Desk project',
    deliverableId: 'd-done',
    stationId: 's-live',
  },
  projects,
});
assert(personalDo.via === 'jump', 'personal Do should jump on Today');
assert(typeof personalDo.target === 'object', 'personal Do must not jump by project id alone');
assert(personalDo.target.stationId === 's-live', 'personal Do dropped stationId');
assert(personalDo.target.deliverableId === 'd-live', 'personal Do should open the deliverable that holds the station');
assert(land(projects, personalDo.target) === 'workbench', 'personal Do should open the station workbench');

// An earlier deliverable still has an open station. Open the task's station,
// not that substitute.
const laterStation = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: {
    id: 't-later',
    projectId: 'p-personal',
    deliverableId: 'd-done',
    stationId: 's-next',
  },
  projects: [
    {
      id: 'p-personal',
      name: 'Desk project',
      deliverables: [
        deliverable('d-done', [station('s-other', false)]),
        deliverable('d-live', [station('s-next', false)]),
      ],
    },
  ],
});
assert(laterStation.target.stationId === 's-next', 'should open the task station, not the earlier current station');
assert(laterStation.target.deliverableId === 'd-live', 'should use the deliverable that holds the task station');
assert(land(projects, laterStation.target) === 'workbench', 'task station should open the workbench');

// Station already resolved on the task's deliverable. Same workbench jump.
const resolved = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: {
    id: 't-resolved',
    projectId: 'p-personal',
    deliverableId: 'd-live',
    stationId: 's-live',
  },
  projects,
});
assert(resolved.via === 'jump', 'resolved station should jump');
assert(resolved.target.stationId === 's-live', 'resolved station id mismatch');
assert(land(projects, resolved.target) === 'workbench', 'resolved station should open the workbench');

// Deliverable link with no stationId still opens the resolved current station.
const currentStation = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: { id: 't-current', projectId: 'p-personal', deliverableId: 'd-live' },
  projects,
});
assert(currentStation.via === 'jump', 'resolved current station should jump');
assert(currentStation.target.stationId === 's-live', 'resolved current station was dropped');
assert(land(projects, currentStation.target) === 'workbench', 'resolved current station should open the workbench');

// A stale stationId still opens the deliverable's current station.
const stale = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: {
    id: 't-stale',
    projectId: 'p-personal',
    deliverableId: 'd-live',
    stationId: 's-gone',
  },
  projects,
});
assert(stale.target.stationId === 's-live', 'stale stationId should fall through to the current station');
assert(land(projects, stale.target) === 'workbench', 'stale stationId should still open a resolved station');

// No station: stay on the Projects grid. Do not invent a workbench.
const projectOnly = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: { id: 't-plain', projectId: 'p-personal', project: 'Desk project' },
  projects,
});
assert(projectOnly.via === 'jump', 'project-only should jump');
assert(projectOnly.target === 'p-personal', 'project-only should open the project by id');
assert(land(projects, projectOnly.target) === 'grid', 'project-only should land on the Projects grid');

// stationId that is not loaded: keep the id, but do not invent a workbench.
const missingStation = todayProjectOpenTarget({
  projectId: 'p-personal',
  task: { id: 't-missing', projectId: 'p-personal', stationId: 's-gone' },
  projects,
});
assert(missingStation.via === 'jump', 'unresolved station on a loaded project should still jump');
assert(missingStation.target.stationId === 's-gone', 'unresolved stationId was dropped');
assert(land(projects, missingStation.target) === 'grid', 'unresolved station must not invent a workbench');

// Team Assigned: project is not loaded here, so the existing open-item path
// keeps stationId for the workspace switch. Do not turn it into a local grid jump.
const assigned = todayProjectOpenTarget({
  projectId: 'p-team',
  task: {
    id: 't-assigned',
    projectId: 'p-team',
    stationId: 's-team',
    deliverableId: 'd-team',
    workspaceId: 'team-1',
  },
  projects,
});
assert(assigned.via === 'item', 'cross-workspace Assigned should use the open-item path');
assert(assigned.target.kind === 'project', 'Assigned open-item kind changed');
assert(assigned.target.stationId === 's-team', 'Assigned stationId was dropped');
assert(assigned.target.deliverableId === 'd-team', 'Assigned deliverableId was dropped');

// Waiting / What's blocking pass no task. A loaded project stays a grid jump.
const waitingChip = todayProjectOpenTarget({ projectId: 'p-personal', projects });
assert(waitingChip.via === 'jump' && waitingChip.target === 'p-personal', 'waiting chip should stay a project jump');

console.log('open project target check ok');
