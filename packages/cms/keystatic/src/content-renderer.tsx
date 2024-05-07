import * as React from 'react';

const Markdoc = await import('@markdoc/markdoc');

export function KeystaticDocumentRenderer({ content }: { content: unknown }) {
  return Markdoc.renderers.react(content as string, React);
}
