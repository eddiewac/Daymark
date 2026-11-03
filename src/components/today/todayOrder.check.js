// Day-2 carry is only the saved top 3. Run with:
//   npx --yes esbuild src/components/today/todayOrder.check.js --bundle --platform=node --format=cjs --outfile=/tmp/today-order-check.cjs && node /tmp/today-order-check.cjs
import { deriveTodayOrder } from './todayOrder.js';

const day1 = '2026-11-02';
const day2 = '2026-11-03';

function row(id, task) {
  return { id, task: { id, ...task } };
}

// Ranked on day 1: a b c are above If time; d and e sit below it.
const stored = { date: day1, ids: ['a', 'b', 'c', 'd', 'e'] };
const rows = [
  row('a', { dueDate: '2026-10-01' }),
  row('b', { dueDate: '2026-10-02' }),
  row('c', { dueDate: '2026-10-03' }),
  row('d', { dueDate: '2026-10-04' }),
  row('e', { dueDate: day2 }),
  row('dead', { deadline: day2, dueDate: '2026-12-01' }),
];

const next = deriveTodayOrder({ rows, stored, today: day2, pinnedIds: [] });
const carried = [...next.carried];

if (carried.length > 3) {
  throw new Error(`expected at most 3 from-yesterday rows, got ${carried.join(',')}`);
}
if (carried.join(',') !== 'a,b,c') {
  throw new Error(`expected carried top 3 a,b,c, got ${carried.join(',')}`);
}
if (next.ids.slice(0, 4).join(',') !== 'a,b,c,dead') {
  throw new Error(`deadline-today should sit under the carried top 3, got ${next.ids.join(',')}`);
}
if (next.ids.indexOf('dead') > next.ids.indexOf('d') || next.ids.indexOf('dead') > next.ids.indexOf('e')) {
  throw new Error(`deadline-today should rank above non-carried rows, got ${next.ids.join(',')}`);
}
if (next.carried.has('d') || next.carried.has('e')) {
  throw new Error('rows below the If-time line were carried');
}

// A finished #1 is not backfilled from If time.
const dropped = deriveTodayOrder({
  rows: rows.filter((item) => item.id !== 'a'),
  stored,
  today: day2,
  pinnedIds: [],
});
if ([...dropped.carried].join(',') !== 'b,c') {
  throw new Error(`finished top row should not promote If-time, got ${[...dropped.carried].join(',')}`);
}
if (dropped.ids[0] !== 'b' || dropped.ids[1] !== 'c' || dropped.ids[2] !== 'dead') {
  throw new Error(`deadline-today should follow the remaining carry, got ${dropped.ids.join(',')}`);
}

console.log('today order carry check ok');
