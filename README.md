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

**CI**: `.github/workflows/ci.yml` corre `check`, `test` e `build` em cada PR e push para `main`. O deploy é só do Workers Builds.
**Merges**: um de cada vez, à espera de que o build da Cloudflare acabe. Builds em paralelo podem acabar fora de ordem e deixar em produção uma versão antiga, como aconteceu a 28/10 (#11 por cima do #13).

## Estrutura

- `src/pages/` — `index` (agora), `[regiao]` (continente, açores, madeira), `sismo/[id]-[slug]` (ficha), `fontes`, `sobre`,
  `og/[id].png` (imagens de partilha), `sitemap.xml` (+ `sitemap-paginas.xml`, `sitemap-sismos-N.xml`), `rss.xml`, `api/*`.
- `src/lib/catalogue.ts` — fogosapi com fallback e cache no edge (60 s).
- `src/lib/sources/` — normalizadores de fogosapi, IPMA, EMSC e USGS.
- `src/scripts/` — sismógrafo (canvas) e mapas (d3-geo), no cliente.
- `src/data/geo.json` — costa (Natural Earth 10m recortada), fronteira PT–ES e limites de placas (PB2002).

## Licença

Código aberto em **[GNU AGPL-3.0-or-later](LICENSE)**, com um termo adicional de atribuição (secção 7(b)):
qualquer cópia, versão modificada ou serviço em rede baseado neste código tem de publicar o código-fonte e
manter visível "Baseado no sismos.pt — VOST Portugal, por Tomahock" com o link para este repositório.
Os dados de terceiros incluídos (falhas GEM em CC BY-SA 4.0, Natural Earth, PB2002, Smithsonian GVP)
mantêm as licenças próprias — ver [NOTICE](NOTICE).

