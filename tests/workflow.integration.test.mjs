import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.OPENROUTER_API_KEY = 'test-key-not-used';
const { prisma } = await import('../server/lib/prisma.ts');
const { default: routes } = await import('../server/routes/workflowRoutes.ts');

test('ticket, AI report, approval and revision preserve linked snapshots', async (context) => {
  const tickets = new Map();
  const drafts = new Map();
  const events = [];
  let generation = 0;
  let releaseGeneration;
  let generationStarted;
  let generationGate = new Promise((resolve) => { releaseGeneration = resolve; });
  let started = new Promise((resolve) => { generationStarted = resolve; });
  const originalFetch = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    const number = ++generation;
    generationStarted();
    await generationGate;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: `Laporan uji ${number}` } }] });
  });
  prisma.officeTicket.create = async ({ data }) => {
    const now = new Date();
    const ticket = { ...data, id: 'ticket-1', status: 'OPEN', notes: '', createdAt: now, updatedAt: now };
    tickets.set(ticket.id, ticket);
    return ticket;
  };
  prisma.officeTicket.findUnique = async ({ where }) => tickets.get(where.id) || null;
  prisma.officeDraft.create = async ({ data }) => {
    const draft = { id: data.id, ticketId: data.ticketId, data: data.data, updatedAt: new Date() };
    drafts.set(draft.id, draft);
    events.push({ id: 'event-1', draftId: draft.id, notes: '', createdAt: new Date(), ...data.events.create });
    return draft;
  };
  prisma.officeDraft.findUnique = async ({ where }) => drafts.get(where.id) || null;
  prisma.officeDraftEvent.findMany = async ({ where }) =>
    events.filter((event) => event.draftId === where.draftId).reverse();
  prisma.$transaction = async (fn) => fn({
    officeDraft: { updateMany: async ({ where, data }) => {
      const current = drafts.get(where.id);
      if (!current || current.updatedAt !== where.updatedAt) return { count: 0 };
      drafts.set(where.id, { ...current, data: data.data, updatedAt: new Date() });
      return { count: 1 };
    } },
    officeDraftEvent: { create: async ({ data }) => {
      events.push({ ...data, id: `event-${events.length + 1}`, createdAt: new Date() });
    } },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/workflow`;
  const call = async (path, method, body) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const ticket = await call('/tickets', 'POST', {
    division: 'paud', category: 'BUG', title: 'Login error', description: 'Langkah reproduksi yang disamarkan',
  });
  assert.equal(ticket.status, 201);
  const creating = call('/tickets/ticket-1/drafts', 'POST');
  await started;
  let snapshot = await call('/activity', 'GET');
  assert.equal(snapshot.data.divisions.find((item) => item.division === 'paud').creating, 1);
  releaseGeneration();
  const created = await creating;
  assert.equal(created.status, 201);
  assert.equal(created.data.draft.ticketId, 'ticket-1');
  assert.equal(created.data.draft.status, 'PENDING');
  assert.equal(created.data.draft.ai.provider, 'openrouter');
  const id = created.data.draft.id;
  const approved = await call(`/drafts/${id}`, 'PATCH', { action: 'APPROVE' });
  assert.equal(approved.data.draft.status, 'APPROVED');
  snapshot = await call('/activity', 'GET');
  assert.equal(snapshot.data.divisions.find((item) => item.division === 'paud').creating, 0);
  generationGate = new Promise((resolve) => { releaseGeneration = resolve; });
  started = new Promise((resolve) => { generationStarted = resolve; });
  const revising = call(`/drafts/${id}`, 'PATCH', { action: 'REVISE', notes: 'Lebih ringkas' });
  await started;
  snapshot = await call('/activity', 'GET');
  assert.equal(snapshot.data.divisions.find((item) => item.division === 'paud').revising, 1);
  releaseGeneration();
  const revised = await revising;
  assert.equal(revised.data.draft.status, 'PENDING');
  assert.equal(revised.data.draft.content, 'Laporan uji 2');
  assert.equal(revised.data.draft.ai.provider, 'openrouter');
  snapshot = await call('/activity', 'GET');
  assert.equal(snapshot.data.divisions.find((item) => item.division === 'paud').revising, 0);
  const history = await call(`/drafts/${id}/events`, 'GET');
  assert.equal(history.data.events.length, 3);
  assert.equal(history.data.events[0].data.ai.provider, 'openrouter');
  assert.equal(history.data.events[0].notes, 'Lebih ringkas');
  assert.equal(history.data.events[1].data.status, 'APPROVED');
  const cyber = await call('/drafts/mandate', 'POST', { division: 'cyber', instruction: 'Susun rencana audit log yang aman.' });
  assert.equal(cyber.status, 201);
  assert.equal(cyber.data.draft.division, 'cyber');
  const cyberApproved = await call(`/drafts/${cyber.data.draft.id}`, 'PATCH', { action: 'APPROVE' });
  assert.equal(cyberApproved.data.draft.status, 'APPROVED');
  const cyberRevised = await call(`/drafts/${cyber.data.draft.id}`, 'PATCH', { action: 'REVISE', notes: 'Sertakan verifikasi manual.' });
  assert.equal(cyberRevised.data.draft.division, 'cyber');
  assert.equal(cyberRevised.data.draft.status, 'PENDING');
});
