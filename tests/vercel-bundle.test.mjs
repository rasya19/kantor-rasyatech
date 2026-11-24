import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);

test('Vercel CJS API bundle loads cleanly in pure Node.js and serves /api/workflow/activity JSON', async () => {
  const bundlePath = path.resolve('api/_bundle.cjs');
  if (!existsSync(bundlePath)) {
    execFileSync(process.execPath, [
      require.resolve('esbuild/bin/esbuild'),
      'server/vercel.ts',
      '--bundle',
      '--platform=node',
      '--target=node20',
      '--format=cjs',
      '--packages=external',
      '--outfile=api/_bundle.cjs',
    ]);
  }

  const handler = require('../api/index.cjs');
  assert.equal(typeof handler, 'function');

  const req = new EventEmitter();
  req.method = 'GET';
  req.url = '/api/workflow/activity';
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
      for (const [k, v] of Object.entries(hdrs)) {
        res.setHeader(k, v);
      }
    }
    return res;
  };
  res.write = (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return true;
  };
  const finished = new Promise((resolve) => {
    res.end = (chunk) => {
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      res.headersSent = true;
      res.emit('finish');
      resolve();
    };
  });

  handler(req, res);
  await finished;

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(Array.isArray(body.divisions));
  assert.equal(body.divisions.length, 7);
});
