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
  return (
    <div className="space-y-4 text-sm text-slate-800">
      <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-4 leading-relaxed">
        {markers.map((marker, index) => {
          const text = draft.content.slice(position, marker.end);
          position = marker.end;
          return (
            <Fragment key={index}>
              {text}
              {marker.sourceIndexes.map((sourceIndex) => (
                <a
                  key={sourceIndex}
                  className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900"
                  href={grounding.sources[sourceIndex].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  [{sourceIndex + 1}]
                </a>
              ))}
            </Fragment>
          );
        })}
        {draft.content.slice(position)}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="font-bold text-slate-900">Sumber riset</h4>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-slate-700">
          {grounding.sources.map((source, index) => (
            <li key={`${source.url}-${index}`}>
              <a
                className="break-all font-medium text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ol>
      </div>
      {grounding.searchSuggestions && (
        <iframe
          title="Saran Google Search"
          className="h-48 w-full rounded-xl border border-slate-200"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={grounding.searchSuggestions}
        />
      )}
    </div>
  );
}
