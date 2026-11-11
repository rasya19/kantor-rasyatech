const sections = [
  'Judul Tren',
  'Konsep',
  'Hook 3 Detik',
  'Naskah Narasi',
  'Caption',
  'Target Platform',
  'Tata Letak Visual',
  'Hal yang Perlu Diverifikasi',
] as const;

type Section = typeof sections[number];

type CapCutScene = {
  scene: number;
  voiceoverText: string;
  captionText: string;
  startSeconds: number;
  endSeconds: number;
  timing: 'estimated';
  visualPrompt: string;
};

function parseSections(content: string): Partial<Record<Section, string>> {
  const parsed: Partial<Record<Section, string>> = {};
  let current: Section | undefined;
  for (const line of content.split(/\r?\n/)) {
    const normalized = line.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    const heading = sections.find((section) => normalized.toLowerCase().startsWith(`${section.toLowerCase()}:`));
    if (heading) {
      current = heading;
      parsed[heading] = [parsed[heading], normalized.slice(heading.length + 1)].filter(Boolean).join('\n').trim();
    } else if (current) {
      parsed[current] = [parsed[current], line].filter(Boolean).join('\n').trim();
    }
  }
  return parsed;
}

function cleanText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/gm, '')
    .trim();
}

function paragraphs(text: string): string[] {
  return cleanText(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

function splitNarration(text: string): string[] {
  const lines = cleanText(text).split(/\r?\n/);
  const explicitScenes: string[] = [];
  let current: string[] = [];
  let foundScene = false;
  for (const line of lines) {
    const marker = line.match(/^\s*(?:scene|adegan)\s*\d+\s*[:.)\-–—]\s*(.*)$/i);
    if (marker) {
      foundScene = true;
      if (current.join('\n').trim()) explicitScenes.push(current.join('\n').trim());
      current = marker[1].trim() ? [marker[1].trim()] : [];
    } else if (foundScene) {
      current.push(line);
    }
  }
  if (foundScene) {
    if (current.join('\n').trim()) explicitScenes.push(current.join('\n').trim());
    return explicitScenes;
  }

  const blocks = paragraphs(text);
  const source = blocks.length ? blocks : [cleanText(text)];
  return source.flatMap((block) => {
    if (/\r?\n/.test(block)) return [block];
    const sentences = block.match(/[^.!?]+(?:[.!?]+["'”’)]*)?|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
    const grouped: string[] = [];
    for (let index = 0; index < sentences.length; index += 2) {
      grouped.push(sentences.slice(index, index + 2).join(' '));
    }
    return grouped.length ? grouped : [block];
  });
}

function splitVisualPrompts(text: string): string[] {
  const lines = cleanText(text).split(/\r?\n/);
  const scenes: string[] = [];
  let current: string[] = [];
  let foundScene = false;
  for (const line of lines) {
    const marker = line.match(/^\s*(?:scene|adegan)\s*\d+\s*[:.)\-–—]\s*(.*)$/i);
    if (marker) {
      foundScene = true;
      if (current.join('\n').trim()) scenes.push(current.join('\n').trim());
      current = marker[1].trim() ? [marker[1].trim()] : [];
    } else if (foundScene) {
      current.push(line);
    }
  }
  if (foundScene) {
    if (current.join('\n').trim()) scenes.push(current.join('\n').trim());
    return scenes;
  }
  return paragraphs(text).flatMap((block) => block.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean));
}

function speakingDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 2.5 * 10) / 10);
}

function safeFilename(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return slug || 'konten-capcut';
}

export function createCapCutExport(title: string, content: string) {
  const parsed = parseSections(content);
  const hook = cleanText(parsed['Hook 3 Detik'] ?? '');
  const narration = cleanText(parsed['Naskah Narasi'] ?? '');
  if (!hook && !narration) throw new Error('Draf tidak berisi hook atau naskah narasi untuk diekspor.');
  const voiceoverBlocks = splitNarration(narration);
  const normalizedHook = hook.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const normalizedNarration = narration.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  if (hook && !normalizedNarration.includes(normalizedHook)) voiceoverBlocks.unshift(hook);
  if (voiceoverBlocks.length === 0) throw new Error('Tidak ada teks voiceover yang dapat diekspor.');

  const prompts = splitVisualPrompts(parsed['Tata Letak Visual'] ?? '');
  let cursor = 0;
  const scenes: CapCutScene[] = voiceoverBlocks.map((voiceoverText, index) => {
    const duration = speakingDuration(voiceoverText);
    const startSeconds = Math.round(cursor * 10) / 10;
    cursor += duration;
    return {
      scene: index + 1,
      voiceoverText,
      captionText: voiceoverText,
      startSeconds,
      endSeconds: Math.round(cursor * 10) / 10,
      timing: 'estimated',
      visualPrompt: prompts.length === 1 ? prompts[0] : prompts[index] ?? '',
    };
  });
  const copyAllScript = scenes.map((scene) => scene.voiceoverText).filter(Boolean).join('\n\n');

  return {
    json: {
      format: 'manual-video-editing-guide-v1',
      title,
      targetPlatforms: cleanText(parsed['Target Platform'] ?? ''),
      voiceoverText: copyAllScript,
      captionTimingNote: 'Panduan ini untuk perakitan manual di timeline editor; bukan file proyek CapCut. Estimasi durasi dihitung pada 150 kata per menit, bukan timing audio.',
      scenes,
      captionSubtitleTimings: scenes.map(({ scene, captionText, startSeconds, endSeconds, timing }) => ({
        scene, text: captionText, startSeconds, endSeconds, timing,
      })),
      visualPrompts: prompts,
      caption: cleanText(parsed.Caption ?? ''),
      visualDirection: cleanText(parsed['Tata Letak Visual'] ?? ''),
      verificationNotes: cleanText(parsed['Hal yang Perlu Diverifikasi'] ?? ''),
    },
    script: copyAllScript,
    filename: `${safeFilename(title)}.json`,
  };
}
