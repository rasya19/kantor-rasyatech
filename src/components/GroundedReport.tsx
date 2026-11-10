import { Fragment } from 'react';
import type { WorkDraft } from '../workflowTypes';

export function GroundedReport({ draft }: { draft: WorkDraft }) {
  const grounding = draft.grounding;
  if (!grounding) return null;
  const markers = grounding.citations.flatMap((citation) => {
    const start = draft.content.indexOf(citation.text);
    return start < 0 ? [] : [{ end: start + citation.text.length, sourceIndexes: citation.sourceIndexes }];
  }).sort((a, b) => a.end - b.end);
  let position = 0;
  return <div className="space-y-3 text-sm">
    <div className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3">{markers.map((marker, index) => {
      const text = draft.content.slice(position, marker.end);
      position = marker.end;
      return <Fragment key={index}>{text}{marker.sourceIndexes.map((sourceIndex) => <a key={sourceIndex} className="text-teal-300 underline" href={grounding.sources[sourceIndex].url} target="_blank" rel="noreferrer">[{sourceIndex + 1}]</a>)}</Fragment>;
    })}{draft.content.slice(position)}</div>
    <div><h4 className="font-bold">Sumber riset</h4>
      <ol className="list-decimal space-y-1 pl-5">{grounding.sources.map((source, index) => <li key={`${source.url}-${index}`}><a className="break-all text-teal-300 underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ol>
    </div>
    {grounding.searchSuggestions && <iframe title="Saran Google Search" className="h-48 w-full border-0" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={grounding.searchSuggestions} />}
  </div>;
}
