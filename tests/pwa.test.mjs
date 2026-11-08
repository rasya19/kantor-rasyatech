import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('manifest points to valid PNG icons with the advertised sizes', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const data = await readFile(`public${icon.src}`);
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(data.readUInt32BE(16), width);
    assert.equal(data.readUInt32BE(20), height);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
});

test('service worker caches only the offline page and never intercepts API or writes', async () => {
  const handlers = {};
  const cached = [];
  const offline = new Response('offline page');
  const caches = {
    open: async () => ({ add: async (url) => cached.push(url) }),
    match: async () => offline,
    keys: async () => [],
  };
  vm.runInNewContext(await readFile('public/sw.js', 'utf8'), {
    self: { addEventListener: (name, handler) => { handlers[name] = handler; }, location: { origin: 'https://office.example' } },
    caches, URL, Response,
    fetch: async () => { throw new Error('offline'); },
  });
  let install;
  handlers.install({ waitUntil: (promise) => { install = promise; } });
  await install;
  assert.deepEqual(cached, ['/offline.html']);

  for (const request of [
    { method: 'GET', url: 'https://office.example/api/workflow/tickets', mode: 'navigate' },
    { method: 'POST', url: 'https://office.example/api/workflow/tickets', mode: 'cors' },
    { method: 'GET', url: 'https://office.example/assets/app.js', mode: 'cors' },
    { method: 'GET', url: 'https://another.example/', mode: 'navigate' },
  ]) {
    let intercepted = false;
    handlers.fetch({ request, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
  let response;
  handlers.fetch({
    request: { method: 'GET', url: 'https://office.example/', mode: 'navigate' },
    respondWith: (promise) => { response = promise; },
  });
  assert.equal(await (await response).text(), 'offline page');
});
