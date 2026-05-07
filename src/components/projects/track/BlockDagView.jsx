import { useMemo } from 'react';
import { projectColor } from '../../../lib/constants.js';
import { stationLastActivityAt, relativeTime } from '../../../lib/stations.js';

// ── BlockDAG visualizer ─────────────────────────────────────────────────────
//
// Renders a project's deliverables as a directed acyclic graph of blocks.
// Each station becomes a block node. Stations within a deliverable connect
// linearly. The visualization is styled to feel like a Kaspa block explorer:
// dark backgrounds, teal glowing edges, hash-like decorations.
//
// Layout: simple layered DAG where each deliverable forms a row, columns are
// station indices. Edges are SVG lines/curves between connected nodes.
//
// Used only when the Kaspa theme is active.

const BLOCK_WIDTH = 140;
const BLOCK_HEIGHT = 70;
const COL_GAP = 60;
const ROW_GAP = 32;
const PADDING = 24;

export default function BlockDagView({
  project,
  allProjects,
  deliverables,
  tasks,
  comms,
  onOpenStation,
}) {
  const color = projectColor(project.name, allProjects);

  // Build the layout: each deliverable is a row, stations are columns.
  const layout = useMemo(() => {
    const rows = (deliverables || []).map((d, rowIdx) => {
      const stations = (d.stations || []).map((s, colIdx) => {
        const x = PADDING + colIdx * (BLOCK_WIDTH + COL_GAP);
        const y = PADDING + rowIdx * (BLOCK_HEIGHT + ROW_GAP);
        return {
          ...s,
          deliverable: d,
          x,
          y,
          colIdx,
          rowIdx,
        };
      });
      return { deliverable: d, stations };
    });

    // Edges connect station[n] → station[n+1] within each deliverable
    const edges = [];
    for (const row of rows) {
      for (let i = 0; i < row.stations.length - 1; i++) {
        const from = row.stations[i];
        const to = row.stations[i + 1];
        edges.push({
          fromX: from.x + BLOCK_WIDTH,
          fromY: from.y + BLOCK_HEIGHT / 2,
          toX: to.x,
          toY: to.y + BLOCK_HEIGHT / 2,
          // Edge "confirmed" if the source station is done — visual cue
          confirmed: !!from.done,
        });
      }
    }

    // Compute total dimensions
    const maxStations = Math.max(0, ...rows.map((r) => r.stations.length));
    const width = PADDING * 2 + Math.max(1, maxStations) * (BLOCK_WIDTH + COL_GAP) - COL_GAP;
    const height = PADDING * 2 + Math.max(1, rows.length) * (BLOCK_HEIGHT + ROW_GAP) - ROW_GAP;

    return { rows, edges, width, height };
  }, [deliverables]);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.headerLabel}>blockdag</span>
          <span style={styles.headerProject}>{project.name}</span>
        </div>
        <div style={styles.headerStats}>
          <span style={styles.statChip}>
            <span style={styles.statDot} />
            {(deliverables || []).length} chains
          </span>
          <span style={styles.statChip}>
            {layout.rows.reduce((sum, r) => sum + r.stations.length, 0)} blocks
          </span>
          <span style={styles.statChip}>
            {layout.rows.reduce(
              (sum, r) => sum + r.stations.filter((s) => s.done).length,
              0
            )}{' '}
            confirmed
          </span>
        </div>
      </div>

      <div style={styles.scroll}>
        <svg
          width={layout.width}
          height={layout.height}
          xmlns="http://www.w3.org/2000/svg"
          style={styles.svg}
        >
          <defs>
            {/* Glow filter for confirmed edges */}
            <filter id="kaspa-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Arrow marker for edges */}
            <marker
              id="kaspa-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3a9b8e" opacity="0.7" />
            </marker>

            {/* Pattern for the block backgrounds — subtle grid */}
            <pattern
              id="kaspa-grid"
              x="0"
              y="0"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(58, 155, 142, 0.06)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width={layout.width} height={layout.height} fill="url(#kaspa-grid)" />

          {/* Edges first (under the blocks) */}
          {layout.edges.map((e, i) => {
            // Curved bezier path between two block midpoints
            const midX = (e.fromX + e.toX) / 2;
            const path = `M ${e.fromX} ${e.fromY} C ${midX} ${e.fromY}, ${midX} ${e.toY}, ${e.toX} ${e.toY}`;
            return (
              <path
                key={`e-${i}`}
                d={path}
                stroke={e.confirmed ? '#3a9b8e' : '#a5c8c2'}
                strokeWidth={e.confirmed ? 2 : 1.5}
                fill="none"
                opacity={e.confirmed ? 0.85 : 0.55}
                filter={e.confirmed ? 'url(#kaspa-edge-glow)' : undefined}
                markerEnd="url(#kaspa-arrow)"
              />
            );
          })}

          {/* Blocks */}
          {layout.rows.map((row) =>
            row.stations.map((s) => (
              <BlockNode
                key={`${row.deliverable.id}-${s.id}`}
                station={s}
                deliverableName={row.deliverable.name}
                color={color}
                onClick={() => onOpenStation(row.deliverable.id, s.id)}
              />
            ))
          )}
        </svg>
      </div>
    </div>
  );
}

// ── Single block node ───────────────────────────────────────────────────────
function BlockNode({ station, deliverableName, color, onClick }) {
  const isDone = !!station.done;
  const isCurrent = !isDone; // Simplification: any non-done station is "current" for visual
  const lastAct = stationLastActivityAt(station);
  const rel = relativeTime(lastAct);

  // Generate a fake "block hash" from the station id for visual flavour
  const hash = (station.id || '').slice(0, 8).toUpperCase();

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      transform={`translate(${station.x}, ${station.y})`}
    >
      {/* Block background */}
      <rect
        width={BLOCK_WIDTH}
        height={BLOCK_HEIGHT}
        rx="4"
        fill={isDone ? 'rgba(58, 155, 142, 0.18)' : '#ffffff'}
        stroke={isDone ? '#3a9b8e' : 'rgba(58, 155, 142, 0.4)'}
        strokeWidth="1"
      />

      {/* Confirmation indicator dot */}
      <circle
        cx={BLOCK_WIDTH - 10}
        cy={10}
        r="3"
        fill="#3a9b8e"
        opacity={isDone ? 1 : 0.4}
      >
        {isDone && (
          <animate
            attributeName="opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Inner glow stroke for done blocks */}
      {isDone && (
        <rect
          width={BLOCK_WIDTH}
          height={BLOCK_HEIGHT}
          rx="4"
          fill="none"
          stroke="#3a9b8e"
          strokeWidth="0.5"
          opacity="0.5"
        />
      )}

      {/* Block hash (top-left) */}
      <text
        x="8"
        y="14"
        fontFamily="monospace"
        fontSize="8"
        fill="#3a9b8e"
        opacity="0.7"
      >
        0x{hash}
      </text>

      {/* Station name (centered) */}
      <text
        x={BLOCK_WIDTH / 2}
        y={36}
        fontFamily="'Roboto Flex', -apple-system, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill={isDone ? '#0f2e2a' : '#4a6b67'}
        textAnchor="middle"
      >
        {truncate(station.name, 18)}
      </text>

      {/* Status / metadata (bottom) */}
      <text
        x={BLOCK_WIDTH / 2}
        y={50}
        fontFamily="'Roboto Flex', -apple-system, sans-serif"
        fontSize="9"
        fill={isDone ? '#3a9b8e' : '#7a9a96'}
        textAnchor="middle"
      >
        {isDone ? '✓ confirmed' : rel || 'pending'}
      </text>

      {/* Deliverable name (very bottom, dimmed) */}
      <text
        x={BLOCK_WIDTH / 2}
        y={62}
        fontFamily="'Roboto Flex', -apple-system, sans-serif"
        fontSize="8"
        fill="#7a9a96"
        textAnchor="middle"
        opacity="0.8"
      >
        {truncate(deliverableName, 22)}
      </text>
    </g>
  );
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    borderBottom: '1px solid var(--border-secondary)',
    background:
      'linear-gradient(180deg, rgba(58, 155, 142, 0.08), transparent)',
  },
  headerTitle: { display: 'flex', alignItems: 'baseline', gap: 8 },
  headerLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.85,
  },
  headerProject: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  headerStats: { display: 'flex', gap: 8 },
  statChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    padding: '3px 8px',
    background: 'rgba(58, 155, 142, 0.1)',
    border: '1px solid rgba(58, 155, 142, 0.25)',
    borderRadius: 3,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 6px rgba(58, 155, 142, 0.5)',
  },
  scroll: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
  },
  svg: { display: 'block' },
};
