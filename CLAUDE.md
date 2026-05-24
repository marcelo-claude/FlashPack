# CLAUDE.md

Flash Pack — app web (React + Vite) para entregadores. Lê o QR Code do pacote (código **SPX TN**) e mostra o **número da parada** da rota do Circuit em letras grandes, para o entregador anotar no canetão.

## Comandos

```bash
npm run dev     # dev server (HTTPS via basic-ssl — exigido pela câmera)
npm run build   # build de produção
npm run test    # vitest (testes de lógica pura em src/utils/*.test.js)
npm run lint    # eslint
```

Deploy de produção: `git push origin master` e depois `npx vercel --prod` (Vercel CLI não é instalada globalmente; use via npx). URL: https://flash-pack-mocha.vercel.app — repo GitHub: marcelo-claude/FlashPack (branch master).

## Fluxo (ARQUIVO ÚNICO)

Usa **só o PDF do Circuit**. O usuário exporta a rota no Circuit marcando a coluna **SPX TN**; o PDF passa a trazer, por parada: número (`#`), endereço e o SPX TN. Não há mais planilha da Shopee (removida em mai/2026, junto com a dependência `xlsx`).

Pipeline de dados:
```
PDF → parseCircuitPDF → [{stopNumber, address, spxTn}]
    → buildPackages    → [{spxTn, stopNumber, address, groupStops, matched:true}]
    → Scanner (busca direta por spxTn) / PackageList
```

## Arquivos

- `src/utils/parseCircuit.js` — extrai paradas do PDF (pdfjs). Exporta `parseCircuitPDF`, e os puros `parseStopLine` / `attachSpxTn`.
- `src/utils/matchPackages.js` — `buildPackages(stops)`: monta a lista de pacotes e agrupa paradas por rua+número (helper `groupKey`).
- `src/components/Upload.jsx` — importação do PDF; avisa se o PDF não tiver SPX TN.
- `src/components/Scanner.jsx` — câmera (`html5-qrcode`, lazy) + busca + overlay.
- `src/components/PackageList.jsx` — lista de pacotes da rota.

## Convenções e armadilhas do parser

- **SPX TN na coluna Notes** (x≈517 no PDF) vem quebrado em 2 fragmentos verticais ao redor da linha da parada (ex: `BR2611038443` + `77S;`). O parser separa a coluna Notes (x ≥ `NOTES_X_MIN`) das colunas da esquerda **antes** de agrupar linhas, associa cada fragmento à parada mais próxima por `y` (`NOTES_Y_TOLERANCE`) e remonta o código de 15 chars. A ordem da junção importa (prefixo `BR` antes do sufixo).
- **pdfjs é importado de forma lazy** dentro de `parseCircuitPDF` — não importe pdfjs no topo do módulo (quebra os testes em Node e incha o bundle inicial).
- **Agrupamento de endereço:** ao bipar, mostra a parada do pacote isolada (`#02`) e lista todas as paradas do mesmo endereço como `01/02/03`.
- Ao mexer no parser, valide contra um PDF real do Circuit (ex: `~/Downloads/Circuit.pdf`) — confira nº de paradas e que todo `spxTn` tem 15 chars começando em `BR`.

## Notas

- `src/components/Scanner.jsx` tem 4 erros de eslint **pré-existentes** (empty catch / setState-in-effect no efeito da câmera). Não são da migração; não confundir com regressões.
- Não commitar PDFs reais de rota (contêm nomes/endereços de clientes) — usar só como fixture local.
- Commits/PR: pedir antes de commitar/deployar; deploy é ação de produção.
