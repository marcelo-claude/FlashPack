# FlashPack — Importação de arquivo único (PDF do Circuit com SPX TN)

**Data:** 2026-05-23
**Status:** Aprovado para implementação

## Problema

Hoje o FlashPack exige **dois arquivos**:

- **PDF do Circuit** — fornece o número da parada (`#`) e o endereço.
- **Planilha da Shopee (.xlsx)** — fornece o código `SPX TN` (lido no QR) e o endereço.

O app cruza os dois por similaridade de endereço (`matchPackages`) só para casar essas duas metades. Isso cria atrito: o usuário precisa baixar, lembrar e carregar dois arquivos. Colegas de trabalho que usam um app concorrente importam **um arquivo só**, e isso é uma barreira para comercializar o FlashPack.

## Descoberta

O Circuit permite incluir colunas extras no PDF exportado da rota (tela "Além das informações de endereço, selecione o que mais você quer ver ao chegar"). Marcando **apenas SPX TN**, o PDF passa a conter, por parada:

- `#` (número da parada)
- Endereço de destino
- **SPX TN** na coluna **Notes**

Verificação no arquivo real (`Circuit.pdf`, rota de 2026-05-23): **170 paradas, 170 códigos SPX, relação 1:1.** Marcar só "SPX TN" é suficiente — endereço já vem sempre.

### Formato do SPX TN no PDF (geometria confirmada via pdfjs)

Cada código aparece na coluna Notes em **x ≈ 517**, quebrado em dois fragmentos verticais ao redor da linha da parada:

```
 y=727  x=517  "BR2611038443"     <- fragmento BR, ~5 acima da linha da parada
 y=722  x=19   "1"                <- número da parada
 y=722  x=48   "Rua Abrolhos, 53, Casa, Santo André"
 y=722  x=433  "23:36"
 y=717  x=517  "77S;"             <- sufixo, ~5 abaixo, com ';' final
```

- Fragmento BR: `"BR"` + 10 dígitos (12 chars).
- Sufixo: 3 chars + `;`.
- **SPX TN completo = 15 chars**, ex.: `BR261103844377S` (junção dos fragmentos, sem o `;`).
- Paradas distam ~32 em `y`; os dois fragmentos do código ficam dentro de ±~10 do `y` da parada. Associar cada fragmento à parada mais próxima por `y` é robusto.

O QR lido pelo scanner contém o código inteiro de 15 chars, sem `;`.

## Decisões de design

| Decisão | Escolha |
|---|---|
| Planilha da Shopee | **Removida.** App passa a usar só o PDF. |
| QR bipado fora do PDF | Mantém tela **"Não encontrado"** atual. |
| Agrupamento por endereço (`01/02/03`) | **Mantido.** |
| PDF sem SPX TN | Exibe **aviso** orientando reexportar com SPX TN marcado. |
| Tela de importação | Orienta o usuário a exportar o PDF **com SPX TN selecionado**. |

## Arquitetura / fluxo de dados

```
PDF Circuit → parseCircuitPDF → [{ stopNumber, address, spxTn }]
            → buildPackages    → [{ spxTn, stopNumber, address, groupStops, matched:true, ... }]
            → onReady          → Scanner (busca direta por spxTn) / PackageList
```

O cruzamento por similaridade de endereço deixa de existir. A única correlação que permanece é o **agrupamento de paradas pelo mesmo endereço** (rua + número), que alimenta o recurso `01/02/03`.

## Componentes

### 1. `src/utils/parseCircuit.js` (modificar)

- Continua extraindo `stopNumber` + `address` das linhas que casam o padrão `nº + endereço + HH:MM`.
- **Novo:** captura os fragmentos da coluna Notes (itens com `x` à direita do início da coluna, ex. `x > 480`).
- Para cada parada, junta os fragmentos Notes cujo `y` esteja na faixa da linha da parada (`|y - stopY| <= 15`), ordenados por `y` decrescente, concatena, remove caracteres não alfanuméricos e extrai o código com regex `BR[0-9A-Z]+`.
- Retorna `[{ stopNumber, address, spxTn }]`. `spxTn` pode ser `''` se a parada não tiver nota.

**Interface:** `parseCircuitPDF(file) → Promise<Array<{stopNumber, address, spxTn}>>`. Depende de `pdfjs-dist`.

### 2. `src/utils/matchPackages.js` → builder de entrada única (modificar)

- Mantém os helpers de agrupamento: `normalize`, `extractStreetNum`, `STREET_TYPES`, `groupKey`.
- Remove a lógica de similaridade Shopee↔Circuit (`wordOverlap`, busca de `bestStop`).
- Nova função (mantendo o nome do arquivo) recebe as paradas do Circuit e devolve a lista de pacotes:
  - Agrupa por `groupKey(address)` para obter `groupStops` (todas as paradas no mesmo endereço, ordenadas).
  - Cada parada vira um pacote: `{ spxTn, stopNumber, address, circuitAddress: address, groupStops, matched: true, score: 100 }`.
  - Ordena por `stopNumber`.

**Interface:** `buildPackages(stops) → Array<package>` (renomear export; atualizar import em `Upload.jsx`).

### 3. `src/utils/parseShopee.js` (remover)

Não é mais usado. Remover o arquivo e o import.

### 4. `src/components/Upload.jsx` (modificar)

- Remove o card e o estado da planilha Shopee (`shopee`, `shopeeError`, `loadingShopee`, `handleXLSX`, `xlsxRef`).
- Fluxo de um arquivo: ao carregar o PDF, chama `buildPackages(stops)` e `onReady(...)` direto.
- **Aviso de PDF sem SPX TN:** se nenhuma parada tiver `spxTn`, **não** chama `onReady` e exibe erro claro orientando reexportar o PDF com a opção SPX TN marcada.
- **Orientação na tela:** o card do PDF e o passo-a-passo "Como usar" instruem a exportar o PDF do Circuit **com a opção SPX TN marcada**.

### 5. `src/components/Scanner.jsx` e `src/components/PackageList.jsx` (sem mudança de lógica)

- Recebem os pacotes pela nova fonte. A busca `packages.find(p => p.spxTn === clean)` e o agrupamento `01/02/03` seguem iguais.
- Branch "Pacote encontrado mas sem parada no Circuit" (`found && !matched`) torna-se inalcançável (todo pacote é `matched`), mas é inofensivo — pode ficar.

### 6. `README.md` (atualizar)

Refletir o fluxo de um arquivo só e a instrução de exportar o PDF com SPX TN.

## Casos de borda

- **Parada sem SPX TN** (nota vazia): aparece na lista, mas não casa com bipagem. Aceitável.
- **PDF antigo sem SPX TN em nenhuma parada:** aviso na importação, não prossegue.
- **QR fora da rota:** tela "Não encontrado".
- **Notes com texto extra** (se o usuário um dia marcar mais campos ou adicionar observações): a extração por regex `BR[0-9A-Z]+` isola o código; texto extra é ignorado.

## Testes

- Parser: rodar `parseCircuitPDF` contra `Circuit.pdf` real e conferir 170 paradas, todas com `spxTn` de 15 chars começando em `BR`.
- Agrupamento: endereços repetidos (ex. "Rua Asa Branca, 55") produzem `groupStops` com múltiplas paradas.
- Fluxo manual: carregar PDF → ir ao Scanner → bipar um QR conhecido → ver `#parada` correto; bipar QR inexistente → "Não encontrado".

## Fora de escopo

- Manter modo de dois arquivos / compatibilidade com planilha Shopee.
- Mudanças visuais no Scanner/PackageList além das já feitas.
