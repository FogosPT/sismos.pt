/**
 * Sentences for the statistics page (PT-PT). Pure functions over the stats
 * document so that every headline is server-rendered (indexable) and tested.
 *
 * Copy rules: "energia libertada" (never "acumulada"), "litosfera" (not
 * "crosta"), "sismos superficiais", no percentage of earthquakes by time of
 * day, and a sober tone on activity above normal (it does not predict a
 * larger earthquake).
 */
import { escapeHtml, num, placeName } from '../format';
import { TIMEZONE } from '../region';
import type { SeismicStats, StatsRegion, StatsWindow } from './types';

export const WINDOWS: { key: StatsWindow; label: string }[] = [
  { key: '30d', label: '30 dias' },
  { key: '1y', label: '1 ano' },
  { key: '10y', label: '10 anos' },
  { key: 'all', label: 'desde 1900' },
];

export const DEFAULT_WINDOW: StatsWindow = '30d';

export function parseWindow(v: string | null | undefined): StatsWindow {
  return WINDOWS.some((w) => w.key === v) ? (v as StatsWindow) : DEFAULT_WINDOW;
}

export const REGION_PHRASE: Record<StatsRegion, string> = {
  pt: 'em Portugal',
  continente: 'no Continente',
  acores: 'nos Açores',
  madeira: 'na Madeira',
};

export const REGION_TITLE: Record<StatsRegion, string> = {
  pt: 'Portugal',
  continente: 'Continente',
  acores: 'Açores',
  madeira: 'Madeira',
};

export function windowPhrase(w: StatsWindow, from: string | null = null): string {
  switch (w) {
    case '7d':
      return 'nos últimos 7 dias';
    case '30d':
      return 'nos últimos 30 dias';
    case '1y':
      return 'no último ano';
    case '10y':
      return 'nos últimos 10 anos';
    case 'all':
      return from ? `desde ${new Date(from).getUTCFullYear()}` : 'em todo o catálogo';
  }
}

const tz = (r: StatsRegion) => TIMEZONE[r === 'pt' ? 'continente' : r];

export function shortDate(iso: string, r: StatsRegion, withYear: boolean): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: tz(r),
    day: 'numeric',
    month: withYear ? 'short' : '2-digit',
    ...(withYear ? { year: 'numeric' } : {}),
  })
    .format(new Date(iso))
    .replace('.', '')
    .replace(/ de /g, ' ');
}

/** "1450 toneladas", "12,3 mil toneladas", "8,6 milhões de toneladas". */
export function tnt(tonnes: number): string {
  if (tonnes < 1) return `${num(tonnes, 2)} toneladas`;
  if (tonnes < 1000) return `${num(tonnes, 0)} toneladas`;
  if (tonnes < 1e6) return `${num(tonnes / 1000, 1)} mil toneladas`;
  return `${num(tonnes / 1e6, 1)} milhões de toneladas`;
}

/** Mean return period in plain language. */
export function every(years: number): string {
  if (years < 1 / 12) return 'mais do que uma vez por mês';
  if (years < 1) {
    const months = Math.round(years * 12);
    return months <= 1 ? 'todos os meses' : `a cada ${months} meses`;
  }
  if (years < 10) return `a cada ${num(years, 1)} anos`;
  return `a cada ${num(years, 0)} anos`;
}

export interface Story {
  id: string;
  /** Headline; may contain <em>, data is escaped. */
  say: string;
  sub: string;
  /** "Ver como se calcula" paragraphs. */
  how: string[];
}

const em = (s: string) => `<em>${s}</em>`;

export function headline(s: SeismicStats): { title: string; sub: string } {
  const where = REGION_PHRASE[s.region];
  const when = windowPhrase(s.window, s.from);
  const title = s.count === 0 ? `Sem sismos registados ${where} ${when}.` : `${num(s.count, 0)} sismos ${where} ${when}.`;
  const parts: string[] = [];
  if (s.window !== 'all' && s.window !== '10y') {
    parts.push(s.felt === 0 ? 'Nenhum foi sentido pela população.' : s.felt === 1 ? '1 foi sentido pela população.' : `${num(s.felt, 0)} foram sentidos pela população.`);
  }
  const max = s.magnitude.max;
  if (max?.magnitude != null) {
    const long = s.window === '10y' || s.window === 'all' || s.window === '1y';
    parts.push(`O maior teve magnitude ${num(max.magnitude, 1)}, a ${shortDate(max.time, s.region, long)}, ${placeName(max.place)}.`);
  }
  return { title, sub: parts.join(' ') };
}

export function storyGutenbergRichter(s: SeismicStats): Story {
  const gr = s.gutenbergRichter;
  const how = [
    'A magnitude de completude (Mc) é a menor magnitude acima da qual o catálogo regista praticamente todos os sismos; estima-se pela curvatura máxima da distribuição, mais 0,2.',
    'O valor b calcula-se por máxima verosimilhança (Aki-Utsu) com os sismos acima de Mc, e a incerteza pelo método de Shi e Bolt.',
  ];
  if (!gr) {
    return {
      id: 'gr',
      say: 'Ainda há poucos sismos para estimar a lei de Gutenberg-Richter neste período.',
      sub: 'É preciso pelo menos meia centena de sismos acima da magnitude de completude. Escolha um período mais longo.',
      how,
    };
  }

  const ratio = Math.pow(10, gr.b);
  const sub = [`É a lei de Gutenberg-Richter: os sismos pequenos são muito mais frequentes. Neste período, o valor b é ${num(gr.b, 2)} (± ${num(gr.sigma, 2)}), com ${num(gr.n, 0)} sismos acima de magnitude ${num(gr.mc, 1)}.`];

  const rp = gr.returnPeriodsYears;
  if (rp && rp['5.0'] != null) {
    sub.push(`A este ritmo, um sismo de magnitude 5 ou mais ${REGION_PHRASE[s.region]} ocorre em média ${every(rp['5.0'])}.`);
    how.push('Os períodos de retorno saem da mesma lei, ajustada aos sismos acima de Mc. São médias de longo prazo, não previsões: dois sismos fortes podem ocorrer com dias de intervalo e depois passarem décadas sem nenhum.');
  }
  if (gr.bootstrap) {
    how.push(`Reamostrando o catálogo ${gr.bootstrap.iterations} vezes, o valor b fica em ${num(gr.bootstrap.mean, 2)} ± ${num(gr.bootstrap.std, 2)}.`);
  }

  return {
    id: 'gr',
    say: `Por cada sismo de magnitude 3, há cerca de ${em(num(ratio, 0))} de magnitude 2.`,
    sub: sub.join(' '),
    how,
  };
}

export function storyEnergy(s: SeismicStats): Story {
  const max = s.magnitude.max;
  const how = [
    'A energia de cada sismo estima-se a partir da magnitude com a relação de Gutenberg-Richter, log₁₀E = 1,5·M + 4,8 (E em joules). Uma tonelada de TNT são 4,184 GJ.',
    'A curva soma a energia libertada por todos os sismos, por ordem de ocorrência.',
  ];
  if (!max || max.magnitude == null || !s.energy.totalJ) {
    return { id: 'energia', say: 'Sem energia libertada a registar neste período.', sub: '', how };
  }
  const share = s.energy.largestShare ?? 0;
  const long = s.window !== '30d' && s.window !== '7d';
  const when = windowPhrase(s.window, s.from);
  const say =
    share >= 0.5
      ? `Um só sismo, o de magnitude ${num(max.magnitude, 1)} a ${shortDate(max.time, s.region, long)}, libertou ${em(`${num(share * 100, 0)}%`)} de toda a energia ${when}.`
      : `A energia libertada ${when} espalhou-se por vários sismos: o maior, de magnitude ${num(max.magnitude, 1)}, libertou ${em(`${num(share * 100, 0)}%`)}.`;
  return {
    id: 'energia',
    say,
    sub: `No total, cerca de ${tnt(s.energy.tntTonnes)} de TNT. A energia cresce cerca de 32 vezes por cada ponto de magnitude, por isso os sismos pequenos quase não contam.`,
    how,
  };
}

export function storyDepth(s: SeismicStats): Story {
  const d = s.depth;
  const known = d.histogram.reduce((a, b) => a + b.n, 0);
  const shallow = d.histogram.filter((b) => b.to != null && b.to <= 10).reduce((a, b) => a + b.n, 0);
  const how = [
    'Profundidade do hipocentro, o ponto onde a rotura começa, medida a partir da superfície.',
    'Quando uma rede não consegue calcular a profundidade, fixa-a num valor (em geral 0 km). Esses sismos contam como profundidade não determinada e ficam fora do gráfico e da mediana.',
  ];
  if (d.median == null || known === 0) {
    return { id: 'profundidade', say: 'Sem profundidades determinadas neste período.', sub: '', how };
  }
  const sub = [`${num((shallow / known) * 100, 0)}% ocorreram nos primeiros 10 km da litosfera. Os sismos superficiais sentem-se mais perto do epicentro, mesmo com magnitude baixa.`];
  if (d.undetermined > 0) {
    sub.push(d.undetermined === 1 ? 'Num sismo, a profundidade não foi determinada.' : `Em ${num(d.undetermined, 0)} sismos, a profundidade não foi determinada.`);
  }
  return {
    id: 'profundidade',
    say: `Metade dos sismos ocorreu a menos de ${em(`${num(d.median, 0)} km`)} da superfície.`,
    sub: sub.join(' '),
    how,
  };
}

export function storyHour(s: SeismicStats): Story {
  return {
    id: 'hora',
    say: 'A que horas ocorrem os sismos.',
    sub: 'Contagem por hora local. A linha tracejada mostra quantos haveria em cada hora se se distribuíssem ao acaso ao longo do dia.',
    how: [
      `Contagem por hora local do epicentro (${s.region === 'acores' ? 'hora dos Açores' : s.region === 'madeira' ? 'hora da Madeira' : 'hora de Lisboa'}).`,
      'As explosões em pedreiras, feitas em horário de trabalho, podem aparecer no catálogo como sismos.',
    ],
  };
}

export function storyRate(s: SeismicStats): Story | null {
  const r = s.rate;
  if (!r) return null;
  const when = windowPhrase(s.window, s.from);
  const expected = r.expected < 10 ? num(r.expected, 1) : num(r.expected, 0);
  const how = [
    `Contam-se os sismos de magnitude ${num(r.mc, 1)} ou mais (a magnitude de completude dos últimos 10 anos) e compara-se com a média dos ${num(Math.round(r.baselineDays / 365.25), 0)} anos anteriores para um período igual.`,
    `Se a atividade fosse a habitual, a probabilidade de observar pelo menos ${num(r.observed, 0)} sismos seria de ${r.pPoisson < 0.0001 ? 'menos de 0,01%' : `${num(r.pPoisson * 100, 2)}%`} (distribuição de Poisson).`,
    'O histórico mais antigo vem de catálogos menos completos do que o atual, o que tende a exagerar a diferença. E mais atividade do que o habitual não permite prever um sismo maior.',
  ];
  const above = r.ratio >= 1.5 && r.pPoisson < 0.01;
  const below = r.ratio <= 0.5 && r.expected >= 5;
  const say = above
    ? `Houve ${em(num(r.observed, 0))} sismos de magnitude ${num(r.mc, 1)} ou mais ${when}, quando o habitual seriam cerca de ${expected}.`
    : below
      ? `Houve menos sismos do que o habitual: ${em(num(r.observed, 0))} de magnitude ${num(r.mc, 1)} ou mais, para cerca de ${expected} esperados.`
      : `Atividade dentro do habitual: ${em(num(r.observed, 0))} sismos de magnitude ${num(r.mc, 1)} ou mais, para cerca de ${expected} esperados.`;
  const sub = above
    ? 'É mais atividade do que o normal para esta região, muitas vezes por causa de uma sequência de réplicas. Não quer dizer que venha aí um sismo maior.'
    : 'Comparação com a média dos últimos dez anos para um período igual.';
  return { id: 'atividade', say, sub, how };
}

export function storySequences(s: SeismicStats): Story | null {
  const seq = s.sequences?.[0];
  if (!seq || seq.mainshock.magnitude == null) return null;
  const long = s.window !== '30d' && s.window !== '7d';
  const p = seq.omoriP;
  const how = [
    `Uma réplica é um sismo posterior dentro da janela de Gardner e Knopoff do sismo principal: para magnitude ${num(seq.mainshock.magnitude, 1)}, até ${num(seq.window.km, 0)} km e ${num(seq.window.days, 0)} dias.`,
    p != null
      ? `O número de réplicas diminui com o tempo segundo a lei de Omori. Nesta sequência o expoente p é ${num(p, 2)}; valores perto de 1 são os habituais.`
      : 'O número de réplicas diminui com o tempo segundo a lei de Omori; esta sequência tem réplicas a menos para estimar o expoente.',
  ];
  return {
    id: 'sequencias',
    say: `O sismo de magnitude ${num(seq.mainshock.magnitude, 1)} a ${shortDate(seq.mainshock.time, s.region, long)}, ${escapeHtml(placeName(seq.mainshock.place))}, foi seguido de ${em(num(seq.aftershocks, 0))} réplicas.`,
    sub: `A maior réplica teve magnitude ${num(seq.largestAftershock, 1)}. A sequência estendeu-se por ${seq.durationDays < 1 ? 'menos de um dia' : `${num(seq.durationDays, 0)} dias`}.`,
    how,
  };
}

export function storyCompleteness(s: SeismicStats): Story | null {
  const years = (s.completenessByYear ?? []).filter((y) => y.mc != null);
  if (years.length < 3) return null;
  const first = years[0];
  const last = years[years.length - 1];
  return {
    id: 'completude',
    say: `Em ${first.year}, o catálogo só registava com segurança os sismos acima de magnitude ${em(num(first.mc!, 1))}. Em ${last.year}, a partir de ${num(last.mc!, 1)}.`,
    sub: 'Com mais estações e melhores redes, os sismos pequenos passaram a ser registados. Por isso as contagens de anos diferentes não se comparam diretamente.',
    how: ['Para cada ano, a magnitude de completude estima-se pela curvatura máxima da distribuição de magnitudes, mais 0,2. Anos com menos de 50 sismos ficam de fora.'],
  };
}

const SOURCE_LABEL: Record<string, string> = { ipma: 'IPMA', emsc: 'EMSC', usgs: 'USGS', geofon: 'GFZ', ign: 'IGN', isc: 'ISC' };

export const sourceLabel = (k: string) => SOURCE_LABEL[k] ?? k.toUpperCase();

export function pairLabel(pair: string): string {
  const [a, b] = pair.split('-');
  return `${SOURCE_LABEL[a] ?? a} − ${SOURCE_LABEL[b] ?? b}`;
}

export function storySources(s: SeismicStats): Story | null {
  const q = s.sourceQuality;
  if (!q) return null;
  const diffs = Object.entries(q.magnitudeDifference).sort((a, b) => b[1].n - a[1].n);
  const lat = Object.entries(q.latencyMinutes).filter(([, v]) => v.n >= 1);
  if (!diffs.length && !lat.length) return null;

  let say = 'Várias instituições registam os mesmos sismos.';
  if (diffs.length) {
    const [pair, d] = diffs[0];
    const [a, b] = pair.split('-');
    say =
      Math.abs(d.median) < 0.05
        ? `O ${SOURCE_LABEL[b] ?? b} e o ${SOURCE_LABEL[a] ?? a} dão, em mediana, ${em('a mesma magnitude')} aos mesmos sismos.`
        : `O ${SOURCE_LABEL[a] ?? a} dá, em mediana, magnitudes ${em(`${num(Math.abs(d.median), 1)} ${d.median > 0 ? 'acima' : 'abaixo'}`)} das do ${SOURCE_LABEL[b] ?? b}.`;
  }
  const fastest = lat.sort((a, b) => a[1].median - b[1].median)[0];
  return {
    id: 'fontes',
    say,
    sub: fastest
      ? `O ${SOURCE_LABEL[fastest[0]] ?? fastest[0]} foi a fonte mais rápida: em mediana, cada sismo chegou ao sismos.pt ${num(fastest[1].median, 0)} minutos depois de ocorrer.`
      : 'Ainda não há sismos suficientes vistos em tempo real para medir a rapidez de cada fonte.',
    how: [
      'Um sismo reportado por várias fontes (até 10 segundos e 30 km de diferença) é o mesmo sismo. Compara-se a magnitude que cada uma lhe deu.',
      'A rapidez mede o tempo entre a hora de origem e o momento em que o sismos.pt viu o sismo pela primeira vez nessa fonte; contam só os vistos em tempo real.',
    ],
  };
}

export function stories(s: SeismicStats): Story[] {
  return [
    storyRate(s),
    storyGutenbergRichter(s),
    storyEnergy(s),
    storySequences(s),
    storyDepth(s),
    storyHour(s),
    storyCompleteness(s),
    storySources(s),
  ].filter((x): x is Story => x !== null);
}
