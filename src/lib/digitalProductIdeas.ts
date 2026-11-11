export type DigitalProductIdea = {
  number: number;
  title: string;
  content: string;
  key: string;
};

export function digitalProductIdeaKey(title: string, content: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'ide';
  let hash = 2166136261;
  for (const character of content) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${slug}-${(hash >>> 0).toString(16)}`;
}

export function extractDigitalProductIdeas(content: string): DigitalProductIdea[] {
  const heading = /^\s*#{1,4}\s*(?:\*\*)?IDE PRODUK\s*(\d+)\s*[:—–-]\s*(.+?)(?:\*\*)?\s*$/gim;
  const matches = [...content.matchAll(heading)];
  return matches.slice(0, 3).map((match, index) => {
    const start = match.index ?? 0;
    const bodyStart = start + match[0].length;
    const nextHeading = matches[index + 1]?.index ?? content.length;
    const sourceHeading = content.slice(bodyStart, nextHeading).search(/^\s*#{1,6}\s*(?:\*\*)?(?:Daftar Sumber|Sumber Rujukan|Sumber Riset)\b/im);
    const end = sourceHeading >= 0 ? bodyStart + sourceHeading : nextHeading;
    const ideaContent = content.slice(start, end).trim();
    const title = match[2].replace(/\*\*/g, '').trim();
    return { number: Number(match[1]), title, content: ideaContent, key: digitalProductIdeaKey(title, ideaContent) };
  }).filter((idea) => idea.title && idea.content.length > 30);
}

export function digitalProductIdeaJobId(draftId: string, key: string): string {
  return `${draftId}:product:${key}:creator-followup`;
}
