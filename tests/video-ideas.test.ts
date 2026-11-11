import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVideoIdeas } from '../src/lib/videoIdeas';

test('numbered markdown video ideas are split into independently selectable content', () => {
    const content = `### **1. Video 1: "Perkenalan Siput PAUD!"**
Konsep: Kenalkan fitur.
Naskah Narasi: "Ini contoh pertama."

---

### **3. Video 3: "Semua Fitur dalam Satu Aplikasi!"**
Konsep: Highlight fitur terverifikasi.
Naskah Narasi: "Ini contoh ketiga."`;
    const ideas = extractVideoIdeas(content);
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].number, 1);
  assert.equal(ideas[0].title, 'Perkenalan Siput PAUD!');
  assert.match(ideas[0].content, /Ini contoh pertama\./);
  assert.doesNotMatch(ideas[0].content, /Ini contoh ketiga\./);
  assert.equal(ideas[1].number, 3);
  assert.equal(ideas[1].title, 'Semua Fitur dalam Satu Aplikasi!');
  assert.match(ideas[1].content, /Ini contoh ketiga\./);
});

test('a regular content package is treated as one selectable video', () => {
  assert.deepEqual(extractVideoIdeas('Naskah Narasi: Satu naskah.', 'Tutorial Siput'), [{
      key: 'package',
      number: null,
      title: 'Tutorial Siput',
      content: 'Naskah Narasi: Satu naskah.',
  }]);
});
