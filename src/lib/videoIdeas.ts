export type VideoIdea = {
  key: string;
  number: number | null;
  title: string;
  content: string;
};

function ideaTitle(value: string): string {
  return value.trim().replace(/^[“"'`]+|[”"'`*]+$/g, '').trim();
}

export function extractVideoIdeas(content: string, fallbackTitle = 'Paket konten'): VideoIdea[] {
  const lines = content.split(/\r?\n/);
  const normalize = (line: string) => line.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
  const heading = /^(?:\d+\.\s*)?Video\s*(\d+)\s*:\s*(.+?)\s*$/i;
  const matches = lines.flatMap((line, index) => {
    const match = normalize(line).match(heading);
    return match ? [{ index, number: Number(match[1]), title: ideaTitle(match[2]) }] : [];
  });

  if (!matches.length) {
    const trendTitle = lines.map(normalize).find((line) => /^Judul Tren\s*:/i.test(line))
      ?.replace(/^Judul Tren\s*:/i, '').trim();
    return [{ key: 'package', number: null, title: trendTitle || fallbackTitle, content }];
  }

  return matches.map((match, index) => {
    const end = matches[index + 1]?.index ?? lines.length;
    const slug = match.title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ide';
    return {
      key: `video-${match.number}-${slug}`,
      number: match.number,
      title: match.title,
      content: lines.slice(match.index, end).join('\n').trim(),
    };
  });
}
