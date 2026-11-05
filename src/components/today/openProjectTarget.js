// Where Today's Open project / project chip should go.
//
// contextForTask stops when a deliverable id matches, even if that deliverable's
// stations are all done and the task's stationId sits on a later one. Opening
// the loaded project by id alone then drops stationId and lands on the grid.
// Pass the station through instead. WorkspaceView.openRecord overlays the
// workbench when that station is loaded, and falls through to the grid when
// it is not. A project that is not loaded stays on the open-item path so a
// cross-workspace Assigned task can still switch workspace with its stationId.

export function contextForTask(task, projects) {
  if (!task) return null;
  let named = null;
  for (const p of projects || []) {
    const idMatch = task.projectId && p.id === task.projectId;
    const nameMatch = task.project && p.name === task.project;
    if (!named && (idMatch || nameMatch)) named = p;
    for (const d of p.deliverables || []) {
      const stations = d.stations || [];
      if (task.stationId) {
        const idx = stations.findIndex((s) => s.id === task.stationId);
        if (idx >= 0) {
          return {
            project: p,
            deliverable: d,
            station: stations[idx],
            next: stations[idx + 1] || null,
          };
        }
      }
      if (task.deliverableId && d.id === task.deliverableId) {
        const idx = stations.findIndex((s) => !s.done);
        const station = idx >= 0 ? stations[idx] : null;
        return {
          project: p,
          deliverable: d,
          station,
          next: station ? stations[idx + 1] || null : null,
        };
      }
    }
  }
  if (named) return { project: named, deliverable: null, station: null, next: null };
  return null;
}

// Loaded station for this task. Prefer the project the click named, then the
// task's own project, so a station on a later deliverable is still found.
function findTaskStation(task, projects, preferProjectId) {
  if (!task?.stationId) return null;
  const prefer = (projectId) => {
    if (!projectId) return null;
    for (const p of projects || []) {
      if (p.id !== projectId) continue;
      for (const d of p.deliverables || []) {
        const station = (d.stations || []).find((s) => s.id === task.stationId);
        if (station) return { projectId: p.id, deliverableId: d.id, stationId: station.id };
      }
    }
    return null;
  };
  const hit = prefer(preferProjectId) || prefer(task.projectId);
  if (hit) return hit;
  for (const p of projects || []) {
    for (const d of p.deliverables || []) {
      const station = (d.stations || []).find((s) => s.id === task.stationId);
      if (station) return { projectId: p.id, deliverableId: d.id, stationId: station.id };
    }
  }
  return null;
}

export function todayProjectOpenTarget({ projectId, task, projects }) {
  const ctx = task ? contextForTask(task, projects) : null;
  const loaded = !!(projectId && (projects || []).some((p) => p.id === projectId));
  // Exact station wins over the current-station substitute contextForTask
  // returns when an earlier deliverable id matches. A missing id still falls
  // through to that substitute, then to the grid.
  if (loaded && task?.stationId) {
    const hit = findTaskStation(task, projects, projectId);
    if (hit) return { via: 'jump', target: hit };
  }
  if (ctx?.project && ctx.deliverable && ctx.station) {
    return {
      via: 'jump',
      target: {
        projectId: ctx.project.id,
        deliverableId: ctx.deliverable.id,
        stationId: ctx.station.id,
      },
    };
  }
  if (loaded && task?.stationId) {
    return {
      via: 'jump',
      target: {
        projectId,
        deliverableId: task.deliverableId || ctx?.deliverable?.id || null,
        stationId: task.stationId,
      },
    };
  }
  if (loaded) return { via: 'jump', target: projectId };
  return {
    via: 'item',
    target: {
      kind: 'project',
      task: task || null,
      projectId: projectId || task?.projectId || null,
      deliverableId: task?.deliverableId || null,
      stationId: task?.stationId || null,
    },
  };
}
