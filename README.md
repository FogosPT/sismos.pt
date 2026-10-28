# sismos.pt

Sismos em Portugal Continental, Açores e Madeira — VOST Portugal, made by Tomahock.

Astro (SSR) em Cloudflare Workers. Os dados vêm da API do Fogos.pt (`v2/seismic/*`, repo
[FogosPT/fogosapi](https://github.com/FogosPT/fogosapi)), que junta IPMA, EMSC, USGS, GFZ, IGN e ISC
e guarda o histórico. Se a API falhar, o site lê diretamente IPMA → EMSC → USGS e avisa o leitor.

## Desenvolvimento

```bash
npm install
cp .dev.vars.example .dev.vars   # opcional: FOGOS_API_KEY
npm run dev                      # http://localhost:4321
npm test                         # vitest
npm run check                    # astro check (tipos)
npm run preview                  # build de produção servida pelo wrangler (workerd)
```

## Deploy

Cada merge em `main` é publicado automaticamente pelos **Cloudflare Workers Builds**
(e cada PR tem um URL de preview). A configuração está em `wrangler.jsonc`.

Configuração inicial (uma vez):

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → GitHub →
   `FogosPT/sismos.pt` (instalar a app *Cloudflare Workers and Pages* na org FogosPT, se pedido).
2. **Project name**: `sismos-pt` (tem de ser igual ao `name` em `wrangler.jsonc`).
3. **Build command**: `npm run build` · **Deploy command**: `npx wrangler deploy` ·
   **Non-production branch deploy command**: `npx wrangler versions upload` · **Root directory**: `/`.
4. **Production branch**: `main`; ativar **Builds for non-production branches** (previews dos PRs).
5. Variáveis de build: `NODE_VERSION=22`.
6. **Obrigatório**: em *Settings → Variables and Secrets*, secret `FOGOS_API_KEY` com o token da
   api.fogos.pt (enviado no header `X-API-Key`; outro nome via variável `FOGOS_API_HEADER`).
   Sem ele o site funciona, mas em modo de fallback (IPMA direto) e com o aviso visível.
   Diagnóstico: `GET /api/status.json` diz que fonte respondeu e porque é que as anteriores falharam.
7. *Settings → Domains & Routes → Add → Custom domain*: `sismos.pt` e `www.sismos.pt`.
   Antes, remover o redirect atual para o IPMA (*Rules → Redirect Rules* / *Page Rules* da zona sismos.pt).

Deploy manual (emergência): `npx wrangler login && npm run deploy`.

## Estrutura

- `src/pages/` — `index` (agora), `[regiao]` (continente, açores, madeira), `sismo/[id]-[slug]` (ficha), `fontes`, `sobre`,
  `og/[id].png` (imagens de partilha), `sitemap.xml` (+ `sitemap-paginas.xml`, `sitemap-sismos-N.xml`), `rss.xml`, `api/*`.
- `src/lib/catalogue.ts` — fogosapi com fallback e cache no edge (60 s).
- `src/lib/sources/` — normalizadores de fogosapi, IPMA, EMSC e USGS.
- `src/scripts/` — sismógrafo (canvas) e mapas (d3-geo), no cliente.
- `src/data/geo.json` — costa (Natural Earth 10m recortada), fronteira PT–ES e limites de placas (PB2002).
