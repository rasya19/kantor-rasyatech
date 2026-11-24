import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function dispatchExpress(app, method, url) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { host: 'kantor-zenith.vercel.app' };
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;

    const chunks = [];
    const headers = new Map();
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headersSent = false;
    res.setHeader = (name, value) => {
      headers.set(String(name).toLowerCase(), value);
    };
    res.getHeader = (name) => headers.get(String(name).toLowerCase());
    res.hasHeader = (name) => headers.has(String(name).toLowerCase());
    res.removeHeader = (name) => {
      headers.delete(String(name).toLowerCase());
    };
    res.getHeaders = () => Object.fromEntries(headers);
    res.writeHead = (status, hdrs) => {
      res.statusCode = status;
      if (hdrs) {
        for (const [key, value] of Object.entries(hdrs)) {
          res.setHeader(key, value);
        }
      }
      return res;
    };
    res.write = (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    res.end = (chunk) => {
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      res.headersSent = true;
      res.emit('finish');
      resolve({
        status: res.statusCode,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      });
    };

    app(req, res);
  });
}

test('compiled api/index.ts runs in strict Node.js ESM without ERR_MODULE_NOT_FOUND and serves core routes', async (t) => {
  const outDir = path.resolve('.tmp-vercel-esm-test');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  t.after(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  const tscBin = path.resolve('node_modules/typescript/bin/tsc');
  const tempTsconfig = path.join(outDir, 'tsconfig.json');
  writeFileSync(tempTsconfig, JSON.stringify({
    compilerOptions: {
      outDir: '.',
      rootDir: '..',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      target: 'ES2022',
      types: ['node'],
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: false,
    },
    files: ['../api/index.ts'],
  }));
  execFileSync(process.execPath, [tscBin, '-p', tempTsconfig]);
  writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'module' }));

  const { prisma } = await import(pathToFileURL(path.join(outDir, 'server/lib/prisma.js')).href);
  const originals = {
    queryRaw: prisma.$queryRaw,
    ticketFindMany: prisma.officeTicket.findMany,
    draftFindMany: prisma.officeDraft.findMany,
    jobFindMany: prisma.officeJob.findMany,
    videoJobFindMany: prisma.videoJob.findMany,
    videoConfigUpsert: prisma.videoRuntimeConfig.upsert,
  };
  prisma.$queryRaw = async () => [{ '?column?': 1 }];
  prisma.officeTicket.findMany = async () => [];
  prisma.officeDraft.findMany = async () => [];
  prisma.officeJob.findMany = async () => [];
  prisma.videoJob.findMany = async () => [];
  prisma.videoRuntimeConfig.upsert = async () => ({
    enabled: false,
    approvedBudgetIdr: 100_000,
    updatedAt: new Date(),
  });
  t.after(() => {
    prisma.$queryRaw = originals.queryRaw;
    prisma.officeTicket.findMany = originals.ticketFindMany;
    prisma.officeDraft.findMany = originals.draftFindMany;
    prisma.officeJob.findMany = originals.jobFindMany;
    prisma.videoJob.findMany = originals.videoJobFindMany;
    prisma.videoRuntimeConfig.upsert = originals.videoConfigUpsert;
  });

  const entry = await import(pathToFileURL(path.join(outDir, 'api/index.js')).href);
  const app = entry.default;
  assert.equal(typeof app, 'function');

  const health = await dispatchExpress(app, 'GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');

  const activity = await dispatchExpress(app, 'GET', '/api/workflow/activity');
  assert.equal(activity.status, 200);
  assert.equal(activity.body.divisions.length, 7);

  const videos = await dispatchExpress(app, 'GET', '/api/workflow/videos');
  assert.equal(videos.status, 200);
  assert.deepEqual(videos.body.jobs, []);

  const tickets = await dispatchExpress(app, 'GET', '/api/workflow/tickets');
  assert.equal(tickets.status, 200);
  assert.deepEqual(tickets.body.tickets, []);

  const drafts = await dispatchExpress(app, 'GET', '/api/workflow/drafts');
  assert.equal(drafts.status, 200);
  assert.deepEqual(drafts.body.drafts, []);

  const jobs = await dispatchExpress(app, 'GET', '/api/office-work/jobs');
  assert.equal(jobs.status, 200);
  assert.deepEqual(jobs.body.jobs, []);
});
