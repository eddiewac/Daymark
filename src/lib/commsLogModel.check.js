// Comms Log merge + metadata limits. Run with:
//   npx --yes esbuild src/lib/commsLogModel.check.js --bundle --platform=node --format=cjs --outfile=/tmp/comms-log-check.cjs && node /tmp/comms-log-check.cjs
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CommsLogList from '../components/comms/CommsLogList.jsx';
import CommsQuickAdd from '../components/comms/CommsQuickAdd.jsx';
import {
  EMPTY_COMMS_LOG,
  LABEL_MAX,
  authorLabel,
  filterCommsEntries,
  mergeCommsLog,
  prepareCommsLogEntry,
  sanitizeLabel,
  sanitizeUrl,
} from './commsLogModel.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const project = {
  id: 'p1',
  name: 'Brand launch',
  deliverables: [
    {
      id: 'd1',
      name: 'Slide deck',
      stations: [
        {
          id: 's1',
          name: 'Client review',
          comms: [
            {
              id: 'chase-1',
              type: 'Chase',
              needsReply: true,
              replyReceived: true,
              expectReplyBy: '2026-11-08',
              sentAt: 2000,
              note: 'DO-NOT-RENDER-NOTE',
              who: 'DO-NOT-RENDER-WHO',
            },
            {
              id: 'legacy-1',
              type: 'Client review request',
              needsReply: true,
              replyReceived: false,
              expectReplyBy: '2026-11-10',
              sentAt: 1000,
              note: 'DO-NOT-RENDER-LEGACY',
            },
          ],
        },
      ],
    },
  ],
};

const rows = [
  {
    id: 'chase-1',
    projectId: 'p1',
    deliverableId: 'd1',
    stationId: 's1',
    type: 'chase',
    authorId: 'me',
    at: '2026-11-05T12:00:00.000Z',
    url: 'https://teams.microsoft.com/l/meetup',
    label: 'Deck sign-off',
    note: 'DO-NOT-RENDER-LOG-NOTE',
  },
  {
    id: 'call-1',
    projectId: 'p1',
    deliverableId: 'd1',
    stationId: 's1',
    type: 'call',
    authorId: 'them',
    at: '2026-11-04T12:00:00.000Z',
    url: '',
    label: '',
  },
];

const merged = mergeCommsLog(rows, [project]);
assert(merged.length === 3, `expected chase + call + legacy, got ${merged.length}`);
assert(merged.map((e) => e.id).join(',') === 'chase-1,call-1,legacy-1', `sort/ids ${merged.map((e) => e.id).join(',')}`);

const chase = merged.find((e) => e.id === 'chase-1');
assert(chase.source === 'log', 'matching id stays a log row');
assert(chase.replyReceived === true, 'reply state comes from the station comm');
assert(chase.needsReply === true, 'needsReply stays on the station comm');
assert(chase.label === 'Deck sign-off', 'label kept');
assert(chase.url.startsWith('https://teams.microsoft.com/'), 'url kept');
assert(!('note' in chase), 'log view has no note field');
assert(!JSON.stringify(chase).includes('DO-NOT-RENDER'), 'note text must not be copied');

const legacy = merged.find((e) => e.id === 'legacy-1');
assert(legacy.source === 'station', 'unlogged station comm is surfaced');
assert(legacy.label === '', 'legacy note is not used as a label');
assert(legacy.needsReply === true && legacy.replyReceived === false, 'legacy waiting state kept');
assert(legacy.projectName === 'Brand launch' && legacy.stationName === 'Client review', 'place names attached');
assert(!JSON.stringify(legacy).includes('DO-NOT-RENDER'), 'legacy note must not be copied');

const call = merged.find((e) => e.id === 'call-1');
assert(call.needsReply === false && call.replyReceived === false, 'call does not invent a waiting row');

const stationOnly = filterCommsEntries(merged, { stationId: 's1' });
assert(stationOnly.length === 3, 'station filter');
const otherProject = filterCommsEntries(merged, { projectId: 'nope' });
assert(otherProject.length === 0, 'project filter drops other ids');

assert(sanitizeLabel('  line\none\ttwo  ').includes(' ') && !sanitizeLabel('a\nb').includes('\n'), 'label is one line');
assert(sanitizeLabel('x'.repeat(200)).length === LABEL_MAX, 'label length cap');
assert(sanitizeUrl('').url === '', 'empty url ok');
assert(sanitizeUrl('javascript:alert(1)').ok === false, 'reject javascript urls');
assert(sanitizeUrl('https://teams.microsoft.com/l/meetup').ok === true, 'https ok');
assert(sanitizeUrl('teams.microsoft.com/l/meetup').url.startsWith('https://teams.microsoft.com/'), 'bare host becomes https');

const built = prepareCommsLogEntry({
  type: 'chase',
  label: 'Follow up\nplease',
  url: 'https://slack.com/archives/C1',
  project,
  deliverable: project.deliverables[0],
  station: project.deliverables[0].stations[0],
  id: 'new-chase',
  at: '2026-11-05T15:00:00.000Z',
  expectReplyBy: '2026-11-10',
});
assert(built.ok, 'chase prepares');
assert(built.entry.id === 'new-chase' && built.stationComm.id === 'new-chase', 'shared id');
assert(built.stationComm.needsReply === true && built.stationComm.replyReceived === false, 'chase feeds Waiting');
assert(built.stationComm.expectReplyBy === '2026-11-10', 'expect date kept for Waiting');
assert(built.entry.label === 'Follow up please', 'label flattened');
assert(!('note' in built.entry) && !('note' in built.stationComm), 'no message body on either side');
assert(!('who' in built.stationComm), 'chase does not store a person field');

const decision = prepareCommsLogEntry({ type: 'decision', label: '', url: '', id: 'dec-1' });
assert(decision.ok && decision.stationComm === null, 'decision does not touch station comms');
assert(prepareCommsLogEntry({ type: 'chat', label: '', url: '' }).ok === false, 'unknown type rejected');

assert(authorLabel('me', { currentUserId: 'me', members: [] }) === 'You', 'self');
assert(authorLabel('them', { currentUserId: 'me', members: [{ id: 'them', email: 'sam@example.com' }] }) === 'sam', 'member');
assert(authorLabel('', {}) === '', 'no author on surfaced station comms');

const html = renderToStaticMarkup(
  React.createElement(CommsLogList, {
    entries: merged,
    place: 'project',
    members: [{ id: 'them', email: 'sam@example.com' }],
    currentUserId: 'me',
    onOpen: () => {},
  })
);
assert(html.includes('Deck sign-off'), 'label rendered');
assert(html.includes('Opens in Teams/Slack'), 'link chip');
assert(html.includes('https://teams.microsoft.com/l/meetup'), 'href');
assert(html.includes('Waiting') && html.includes('Replied'), 'waiting state');
assert(html.includes('Client review request'), 'legacy type');
assert(!html.includes('DO-NOT-RENDER'), 'notes are not rendered');
assert(!/Discussion|Chat|Messages/.test(html), 'no chat labels');

const emptyHtml = renderToStaticMarkup(React.createElement(CommsLogList, { entries: [] }));
assert(emptyHtml.includes(EMPTY_COMMS_LOG), 'empty state teaches the model');

const quick = renderToStaticMarkup(
  React.createElement(CommsQuickAdd, {
    label: '',
    url: '',
    onLabel: () => {},
    onUrl: () => {},
    onLog: () => {},
    busy: false,
  })
);
assert(quick.includes('Log chase') && quick.includes('Log call') && quick.includes('Log decision'), 'one-tap types');
assert(quick.includes('no client details'), 'label hint');
assert(quick.includes('80 characters'), 'length hint');
assert(!quick.includes('<textarea'), 'no message body field');

console.log('comms log checks ok');
