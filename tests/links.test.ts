import { describe, expect, it } from 'vitest';
import { externalLinksInNewTab, isExternal } from '../src/lib/links';

describe('external links', () => {
  it('tells external from internal', () => {
    expect(isExternal('https://www.ipma.pt/pt/')).toBe(true);
    expect(isExternal('//cdn.example.com/x')).toBe(true);
    expect(isExternal('/sismo/abc')).toBe(false);
    expect(isExternal('#i-seta')).toBe(false);
    expect(isExternal('mailto:a@b.pt')).toBe(false);
    expect(isExternal('https://sismos.pt/acores')).toBe(false);
    expect(isExternal('https://www.sismos.pt/')).toBe(false);
  });

  it('opens external links in a new tab', () => {
    expect(externalLinksInNewTab('<a href="https://www.ipma.pt">IPMA</a>')).toBe('<a href="https://www.ipma.pt" target="_blank" rel="noopener noreferrer">IPMA</a>');
    expect(externalLinksInNewTab('<a class="x" href="https://osm.org/?a=1&amp;b=2">m</a>')).toBe('<a class="x" href="https://osm.org/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">m</a>');
    // A rel already set is kept.
    expect(externalLinksInNewTab('<a href="https://vost.pt" rel="me">v</a>')).toBe('<a href="https://vost.pt" rel="me" target="_blank">v</a>');
  });

  it('leaves internal links, explicit targets and look-alikes alone', () => {
    const html = '<a href="/acores">A</a><a href="https://sismos.pt/">s</a><a href="https://x.pt" target="_self">x</a><abbr title="https://x.pt">x</abbr><use href="https://x.pt#i"/>';
    expect(externalLinksInNewTab(html)).toBe(html);
  });
});
