// Capture B — split a free-text dump into triage rows.
// The mock's fixed 6 rows are demo-only; production parses whatever was dumped.

export function cleanDumpLine(line) {
  return String(line || '')
    .trim()
    .replace(/^([-*•]|\d+[.)])\s+/, '')
    .trim();
}

export function guessKind(title) {
  const t = title || '';
  if (/\b(waiting|wait on|chase|chasing|awaiting|await|need by)\b/i.test(t)) return 'waiting';
  if (/\b(spin up|kick off|new project)\b/i.test(t)) return 'project';
  return 'task';
}

// Longest project name contained in the line wins, so a tag can prefill
// without the user re-picking it. Names under 3 characters are ignored.
export function projectMatch(title, projects) {
  const lower = String(title || '').toLowerCase();
  let best = null;
  for (const p of projects || []) {
    const name = (p.name || '').trim();
    if (name.length < 3) continue;
    if (lower.includes(name.toLowerCase())) {
      if (!best || name.length > best.name.length) best = p;
    }
  }
  return best;
}

export function parseDumpLines(text) {
  const rows = [];
  const seen = new Set();
  for (const raw of String(text || '').split('\n')) {
    const title = cleanDumpLine(raw);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    rows.push({ title, kind: guessKind(title) });
  }
  return rows;
}

export function removeDumpLines(body, titles) {
  const drop = new Set((titles || []).map((t) => String(t).trim()).filter(Boolean));
  return String(body || '')
    .split('\n')
    .filter((line) => {
      const cleaned = cleanDumpLine(line);
      if (!cleaned) return false;
      return !drop.has(cleaned);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
