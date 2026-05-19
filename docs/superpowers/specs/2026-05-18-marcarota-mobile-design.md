# MarcaRota Mobile — Design

**Data:** 2026-05-18
**Status:** Aprovado (pendente confirmação de nome — ver §10)
**Autor:** Marcelo Vieira + Claude
**Codename interno:** MarcaRota (substitui FlashPack neste produto)

---

## 1. Resumo executivo

App Android nativo, em Expo (React Native), que ajuda entregadores da Shopee a **numerar os pacotes da rota** e **organizá-los em ordem no veículo** antes de iniciar a entrega. Reproduz o que o web atual FlashPack já faz (cruzar planilha Shopee XLSX com manifesto Circuit/Spoke PDF e ler o QR code de cada pacote pra indicar o número da parada), mas com câmera nativa contínua, suporte amplo a aparelhos modestos e um aviso novo quando há múltiplos pacotes no mesmo endereço.

Modelo de negócio: **assinatura mensal via Google Play Billing**, R$ 19,90/mês de lançamento (alvo de longo prazo R$ 29,90), 7 dias grátis, gerenciada por RevenueCat (sem backend próprio).

Lançamento em 4 fases — APK beta na mão dos amigos em ~1 semana; venda pública em ~6 semanas.

**Constraint crítico:** o app web FlashPack atual (em produção no Vercel) **não pode ser alterado** durante o desenvolvimento. O autor usa em produção real. O app mobile vive em repositório separado.

---

## 2. Contexto e propósito

### Quem usa
Entregadores Shopee no Brasil, começando pelos amigos do autor. Aparelhos variados, incluindo Android antigos com câmera ruim. Trabalham em rota a pé/moto, 8h por dia, frequentemente sem boa cobertura 4G.

### O problema
1. Shopee fornece um XLSX com todos os pacotes do dia (170 na rota de exemplo), incluindo o **SPX TN** (código que aparece no QR da etiqueta).
2. O entregador exporta esses pacotes para o **Circuit/Spoke** (otimizador de rotas líder do segmento), que devolve um PDF com a ordem otimizada das paradas.
3. Circuit/Spoke **não lê QR code** — exige busca textual do endereço.
4. Antes de iniciar a rota, o entregador precisa numerar cada pacote com canetão (escrevendo o número da parada) e organizá-los no veículo em ordem inversa (últimos no fundo, primeiros na frente).
5. Sem ferramenta, isso significa digitar 170 endereços manualmente.

O MarcaRota resolve esse gap: lê o QR do pacote, mostra o número da parada do Circuit, marca como processado. Depois da numeração e organização, o entregador inicia a rota usando o Circuit pra navegar normalmente.

### Diferencial vs. concorrente
"Numera Rápido" (R$ 30/mês) já existe na Play Store com a mesma proposta básica. MarcaRota se diferencia em:
- Câmera contínua (não reinicia entre leituras)
- Suporte a câmeras de baixa qualidade
- **Aviso de pacotes vizinhos**: quando uma parada tem múltiplos pacotes no mesmo endereço, exibe contagem e lista das paradas relacionadas
- Preço de entrada R$ 19,90 (~33% abaixo)

### Princípio guia
> MarcaRota não é navegação — o Circuit faz isso. MarcaRota serve para (1) numerar paradas com canetão antes de sair e (2) organizar os pacotes em ordem dentro do veículo. Em campo, ao retirar um pacote, o entregador vê o número da parada e, se houver múltiplos pacotes no mesmo endereço, é avisado pra pegar todos juntos.

---

## 3. Stack técnica

| Camada | Escolha | Justificativa |
|---|---|---|
| Runtime | Expo SDK 54+, TypeScript, EAS Build | Maduro, OTA updates, build cloud |
| Navegação | Expo Router (file-based) | Padrão Expo, simples pra 3 telas |
| Câmera/Scanner | `react-native-vision-camera` v4 + `vision-camera-code-scanner` | Frame processor contínuo, controle de foco/exposição, performance superior a `expo-camera` |
| Estado global | Zustand | 1KB, sem boilerplate, seletores granulares |
| Parse XLSX | `xlsx` (SheetJS) | Mesma lib do web, roda em RN |
| Parse PDF | **Endpoint serverless Vercel** (Node + pdfjs-dist) | `pdfjs-dist` não roda bem em RN; endpoint reutiliza lógica do web em Node |
| Auth | `expo-auth-session` + Google Sign-In | Sem Firebase, 1 toque |
| Pagamento | `react-native-purchases` (RevenueCat) | Wrapper sobre Google Play Billing, gerencia entitlements |
| Storage local | `AsyncStorage` (rota cache) + `expo-secure-store` (tokens) | Padrão Expo |
| Crash report | Sentry | Grátis até 5k events/mês, essencial pra app de campo |
| Distrib | EAS Build + EAS Submit | APK pra beta, AAB pra Play Store |

### Decisão crítica — Parse do Circuit PDF
O parser atual (`parseCircuit.js`) usa `pdfjs-dist` com Web Worker, incompatível com RN. Opções avaliadas:

- **A. Função serverless Vercel** (✅ escolhida) — endpoint `/api/parse-circuit` num projeto Vercel novo dedicado ao mobile. Recebe PDF, retorna `[{stopNumber, address}, ...]`. Reutiliza `parseCircuit.js` portado pra Node. Upload é feito em casa antes da rota, então internet ok.
- B. Porto pra RN com `react-native-pdf-lib` — frágil, custo alto.
- C. Pedir CSV em vez de PDF — Circuit exporta CSV também, mas exigiria que o entregador mude o workflow atual.

**Importante:** o endpoint vai num **deploy Vercel novo** (`marcarota-api.vercel.app` ou similar), **não no projeto FlashPack web atual**, pra zero risco de afetar o app em produção.

---

## 4. Arquitetura

### Estrutura de pastas (novo repo `marcarota-mobile`)

```
marcarota-mobile/
├── app/                          # Expo Router
│   ├── _layout.tsx               # Providers (Auth, RC, Theme)
│   ├── (auth)/
│   │   └── sign-in.tsx
│   ├── (paywall)/
│   │   └── paywall.tsx
│   └── (app)/
│       ├── _layout.tsx           # Bottom tabs + gate de entitlement
│       ├── upload.tsx
│       ├── list.tsx
│       └── scan.tsx
│
├── src/
│   ├── domain/                   # Lógica pura, testável em Node
│   │   ├── parseShopee.ts
│   │   ├── matchPackages.ts
│   │   ├── groupByAddress.ts     # NOVO
│   │   ├── normalize.ts          # extractStreetNum, normalize
│   │   └── types.ts
│   ├── services/
│   │   ├── circuitParser.ts      # Cliente do endpoint /api/parse-circuit
│   │   ├── auth.ts
│   │   └── purchases.ts          # Stub na Fase 1, real na Fase 3
│   ├── stores/
│   │   ├── routeStore.ts         # Zustand
│   │   └── authStore.ts
│   ├── components/
│   │   ├── CameraView.tsx
│   │   ├── ScanResult.tsx
│   │   ├── PackageRow.tsx
│   │   └── FileUpload.tsx
│   └── lib/
│       ├── storage.ts
│       └── feedback.ts            # Vibração + som de bipe
│
├── api/                          # Pode ser repo separado se preferir
│   └── parse-circuit.ts          # Endpoint Vercel
│
├── tests/
│   ├── fixtures/                 # XLSX e PDF reais (anonimizados)
│   └── domain/                   # Jest puro
│
├── app.config.ts
├── eas.json
└── package.json
```

### Princípio: domínio isolado
`src/domain/` não importa nada de Expo nem React Native. Roda em Node puro. Toda a lógica de negócio (parse Shopee, matching, agrupamento) é testável com Jest sem mock. Isso preserva valor: a lógica já foi validada em campo no web atual.

### Fluxos principais

**Fluxo 1 — Setup da rota (em casa, antes de sair):**
1. Entregador abre app → tela Upload.
2. Toca "Carregar planilha Shopee" → seleciona `Shopee.xlsx` → `parseShopee()` local → array de pacotes.
3. Toca "Carregar manifesto Circuit" → seleciona `Circuit.pdf` → upload pro endpoint → recebe stops.
4. `matchPackages(stops, pkgs)` → array de `MatchedPackage`.
5. `groupByAddress(matched)` → Map `addressKey → AddressGroup`.
6. Persiste em `routeStore` + AsyncStorage.
7. Roteia pra tela Lista.

**Fluxo 2 — Numerar pacotes (carregando o veículo):**
1. Tab Scanner → CameraView abre uma única vez.
2. Câmera fica ativa continuamente. Vision Camera processa frames.
3. Ao detectar qualquer QR/barcode legível (sem filtro de formato — segue o padrão do web atual):
   - **Dedupe:** se a mesma string foi lida há menos de 3s, ignora silenciosamente.
   - Busca direta em `routeStore.packages.find(p => p.spxTn === code)`.
   - Encontrou → consulta `routeStore.groups[p.addressKey]`.
   - Grupo tamanho 1: overlay verde com o número da parada em **letras gigantes** (padrão UX herdado do web — entregador olha de relance) + endereço abaixo.
   - Grupo tamanho > 1: overlay azul, mesmo número gigante + "M pacotes neste endereço (N1, N2, …)".
   - Marca `scanned=true`.
   - Vibração curta + bipe agudo (ou duplo se grupo > 1).
4. Overlay some em 1.5s automaticamente. Câmera permanece ativa.
5. Se a leitura corresponde a um pacote já `scanned=true`: feedback cinza "já bipado, parada N".
6. Se a leitura não corresponde a nenhum pacote da rota: feedback vermelho + bipe grave "QR Code não está na planilha".

**Fluxo 3 — Persistência leve:**
- Mudança em `routeStore` → debounce 1s → grava JSON em AsyncStorage chave `@marcarota:route`.
- Cold start: hidrata do AsyncStorage, recalcula `groups` em memória.
- Tela Upload tem botão "Nova rota" com confirmação se já houver rota com `loadedAt < 24h`.

### Decisões de UX
- **Câmera sempre ativa** na tela Scanner (sem reinicialização entre leituras).
- **Número da parada em letras gigantes** no overlay (decisão herdada do web — entregador lê de relance enquanto manuseia o pacote).
- **Dedupe de 3s** evita feedback duplicado quando o leitor capta o mesmo QR em frames consecutivos.
- **Feedback sonoro+vibração** diferenciado por estado (sucesso, múltiplos, repetido, não-encontrado, erro).
- **Sem botão "scanear"** — a tela inteira é a câmera, leitura automática.
- **Lista** ordenada por `stopNumber`, com tag visual quando o pacote pertence a grupo de tamanho > 1 (ex: "+3 no mesmo endereço").
- **Busca por texto** na lista (rua, número, SPX TN).

### Permissões Android (declaradas em `app.config.ts`)
- `android.permission.CAMERA` — scanner (obrigatório, prompt nativo na 1ª abertura da tela Scanner).
- `android.permission.INTERNET` — upload PDF pro endpoint Vercel, RevenueCat, Sentry, Google Sign-In.
- `android.permission.VIBRATE` — feedback tátil em cada leitura.
- `android.permission.RECEIVE_BOOT_COMPLETED` — **não necessário** (sem background tasks).

Sem permissões de localização, sem permissões de armazenamento (Android 13+ não exige para o uso atual de document picker). Quanto menos permissões, melhor a aprovação na Play Store.

---

## 5. Modelo de dados

### Tipos (`src/domain/types.ts`)

```ts
export type ShopeePackage = {
  spxTn: string          // "BR265626381907Z"
  address: string
  bairro: string
  city: string
  zipcode: string
  lat: number
  lng: number
}

export type CircuitStop = {
  stopNumber: number
  address: string        // "R Ancara, 100, Bloco 2 apto 705, Santo André"
}

export type MatchedPackage = {
  spxTn: string
  address: string
  bairro: string
  city: string
  stopNumber: number | null
  circuitAddress: string | null
  addressKey: string           // "r ancara 100" — chave de agrupamento
  score: number                // 0..100
  matched: boolean             // score >= 55
  scanned: boolean
  scannedAt: number | null     // epoch ms
}

export type AddressGroup = {
  addressKey: string
  displayAddress: string       // "R Ancara, 100" — pra UI
  stopNumbers: number[]
  packages: MatchedPackage[]
}
```

### Estado (`src/stores/`)

```ts
// routeStore.ts
type RouteState = {
  packages: MatchedPackage[]
  groups: Map<string, AddressGroup>
  loadedAt: number | null
  loadRoute: (shopee: ShopeePackage[], circuit: CircuitStop[]) => void
  markScanned: (spxTn: string) => void
  reset: () => void
  getGroupOf: (spxTn: string) => AddressGroup | null
}

// authStore.ts
type AuthState = {
  user: { id: string; email: string; name: string } | null
  entitlement: 'active' | 'inactive' | 'unknown'
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshEntitlement: () => Promise<void>
}
```

### Persistência (AsyncStorage)

| Chave | Conteúdo | Quando grava | Quando lê |
|---|---|---|---|
| `@marcarota:route` | `{packages, loadedAt}` JSON | Debounce 1s após mudança | Cold start |
| `@marcarota:user` | `{id, email, name}` | Após sign-in | Cold start |

`groups` é derivado de `packages` — recalculado no hydrate, não persistido (evita inconsistência).

### Tratamento de erros

| Cenário | Comportamento |
|---|---|
| XLSX inválido / coluna faltando | Toast vermelho específico ("coluna SPX TN não encontrada"). Mantém estado anterior. |
| PDF não-Circuit | Endpoint retorna 422. App mostra "Esse PDF não parece ser do Circuit/Spoke". |
| Sem internet no upload PDF | Toast "Sem internet — conecte e tente novamente". App não trava. |
| Match com score < 55% | Pacote aparece na lista marcado "⚠ Endereço incerto" no fim. Entregador decide. |
| Pacote escaneado fora da rota | Feedback vermelho + som grave. |
| QR ilegível | Vision Camera retenta automaticamente, sem feedback de erro. |
| App fecha durante uso | Snapshot mais recente em AsyncStorage (≤1s atraso). Reabriu, voltou onde estava. |
| Câmera negada | Tela com botão "Abrir configurações". |
| Endpoint /api/parse-circuit lento | Timeout 10s + 1 retry. Mensagem clara se falhar. |

---

## 6. Auth e monetização

### Auth — Google Sign-In via `expo-auth-session`

```
App abre
  ├─ Cache em SecureStore? → restore + checa entitlement
  └─ Não → tela sign-in → Google → SecureStore → Purchases.logIn(userId)
```

Sem Firebase. `userId` é o sub do idToken Google, usado como `app_user_id` no RevenueCat.

### Monetização — RevenueCat

**Produtos no Google Play Console:**
- `marcarota_monthly` — assinatura mensal R$ 19,90/mês com **7 dias de trial**.

**RevenueCat dashboard:**
- Entitlement: `pro`
- Offering: `default` → package `monthly`

**Gate de acesso** em `app/(app)/_layout.tsx`:
1. Verifica sessão.
2. Verifica entitlement (cache RC 5min).
3. Sem entitlement ativo → redireciona pro paywall.

**Importante:** verificação **não bloqueia uso offline**. Se RC falhar, confia no último cache. Entregador em campo sem 4G continua trabalhando.

### Paywall

Tela minimalista com:
- Bullets de benefício (scanner contínuo, aviso de pacotes vizinhos, 100% offline).
- Botão "7 dias grátis · depois R$ 19,90/mês".
- Link "Restaurar compra" (`Purchases.restorePurchases()`).
- Links pra termos e privacidade.

### Estratégia de preço

| Fase | Preço | Estratégia |
|---|---|---|
| Lançamento (0–50 assinantes) | **R$ 19,90/mês** | ~33% abaixo do concorrente Numera Rápido |
| Após 50 assinantes ou 6 meses | **R$ 29,90/mês** | Alinha com mercado |

Primeiros assinantes mantêm o preço inicial (grandfathered pricing do Google Play). Vira argumento de marketing pra primeira leva.

### Fase 1 — stubs

Toda a infra de auth/monetização fica stubada na Fase 1:
- `purchases.ts` retorna `entitlement.active` sempre.
- `auth.ts` pode ser real (testar fluxo Google com amigos) ou anônimo.
- Paywall existe como tela, mas não é roteado.

Fase 3 troca stubs por chamadas reais ao SDK.

---

## 7. Testes e critérios de aceitação

### Estratégia (pirâmide enxuta)

| Camada | Cobertura | Ferramenta |
|---|---|---|
| Unit (domain) | Alta — coração do produto | Jest puro |
| Unit (services) | Média | Jest + msw |
| Componentes | Baixa — só os críticos | `@testing-library/react-native` |
| E2E | Manual com fixtures reais nas fases 1 e 2 | — |

### Fixtures
`tests/fixtures/`: `Shopee.xlsx` e `Circuit.pdf` reais (anonimizados) + snapshots JSON esperados.

### Casos obrigatórios — `groupByAddress`
- Agrupa 4 pacotes da "R Ancara, 100" com complementos diferentes em 1 grupo `[3, 4, 5, 6]`.
- Não agrupa "Rua Almada, 730" e "Rua Almada, 515" (mesma rua, números diferentes).
- Agrupa "Rua Germânia, 495" duplicada em grupo `[56, 57]`.
- Endereço único permanece em grupo tamanho 1.
- Pacote sem match (`stopNumber=null`) não entra em grupo.

### Critérios de aceitação por fase

**Fase 1 — Paridade rodando**
- [ ] Carregar Shopee.xlsx (170 pacotes) em < 2s.
- [ ] Carregar Circuit.pdf via endpoint em < 5s.
- [ ] Matching com ≥ 95% de pacotes encontrados.
- [ ] Câmera abre em < 1s no primeiro uso, instantâneo depois.
- [ ] Câmera não reinicia durante a sessão.
- [ ] QR Shopee lido em < 500ms com etiqueta nítida.
- [ ] Funciona em aparelho fraco/antigo de referência.
- [ ] Overlay mostra contagem quando grupo > 1; apenas parada quando único.
- [ ] Cold start restaura rota.
- [ ] App estável escaneando os 170 pacotes em sequência.

**Aparelhos de referência:**
- 1 topo (Pixel/Galaxy mid-tier 2023+)
- 1 médio (Moto G 2022, Galaxy A20+)
- 1 fraco (Galaxy J / Moto E / Android 8+ câmera ruim)

**Fase 2 — Field test**
- [ ] 3 entregadores usam 1 dia inteiro de rota.
- [ ] Zero crash no Sentry.
- [ ] Nenhum precisou voltar pro web atual.
- [ ] Feedback qualitativo coletado.

**Fase 3 — Monetização**
- [ ] Login Google < 3s.
- [ ] Compra em ambiente de teste Play Console.
- [ ] Restaurar compra em segundo aparelho.
- [ ] Entitlement persiste offline.
- [ ] Trial 7 dias apenas na primeira instalação por conta Google.

**Fase 4 — Publicação**
- [ ] Listing completo (ícone, screenshots, descrição PT-BR).
- [ ] Política de privacidade publicada (URL pública).
- [ ] Closed beta 14 dias sem problemas.
- [ ] Promoção pra produção.

### Observabilidade
Sentry desde Fase 1. Sem analytics de produto no MVP (público pequeno, contato direto).

---

## 8. Cronograma e fases

**Total:** ~27 dias de trabalho focado + 14 dias de closed beta obrigatório = **~6 semanas** até venda pública. APK na mão dos amigos em **~1 semana**.

### Fase 1 — Paridade (7 dias)
| Dia | Entrega |
|---|---|
| 1 | Setup Expo + EAS + repo novo + Sentry. Tabs com 3 telas vazias. |
| 2 | Port `parseShopee` e `matchPackages` pra TS + testes com fixtures. |
| 3 | Tela Upload + `expo-document-picker`. Endpoint `/api/parse-circuit` Vercel novo. |
| 4 | `groupByAddress` + testes. Tela Lista com agrupamento visível. |
| 5 | Scanner com vision-camera (câmera contínua, feedback UI). |
| 6 | Persistência AsyncStorage + cold start hidratado. Sons + vibração. |
| 7 | Build APK via EAS. Distribuição interna pros 3 amigos. |

### Fase 2 — Field test (10 dias corridos)
| Dia | Atividade |
|---|---|
| 8–14 | 3 amigos usam em rota real. Coleta de feedback. |
| 15–17 | Correções com base no feedback. |

### Fase 3 — Monetização (5 dias)
| Dia | Entrega |
|---|---|
| 18 | Google Sign-In + tela auth. |
| 19 | RevenueCat + Play Console (produto `marcarota_monthly`). |
| 20 | Paywall + gate + restore. |
| 21 | Teste de compra ponta a ponta com conta de teste. |
| 22 | Screenshots + textos da Play Store. |

### Fase 4 — Publicação (5 dias + espera Google)
| Dia | Entrega |
|---|---|
| 23 | Política de privacidade pública. Listing Play Console completo. |
| 24 | Submissão closed beta. |
| 25–38 | Closed beta 14 dias (exigência Google pra trials). |
| 39 | Promoção pra produção pública. |

---

## 9. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Vision Camera ruim em aparelho antigo | Média | Alto | Fase 1 já testa em aparelho fraco. Fallback `expo-camera` decidido no dia 5. |
| Endpoint /api/parse-circuit lento/falha | Baixa | Médio | Timeout 10s + retry. Plano B: porto inline com `react-native-pdf-lib` (+2 dias). |
| Mudança no formato Shopee.xlsx | Baixa | Alto | Testes de snapshot pegam regressão. |
| Mudança no formato Circuit/Spoke PDF (rebranding recente) | Média | Alto | Parser baseado em regex linha-a-linha, resiliente a layout. Acompanhar de perto. |
| Recusa da Google Play | Baixa | Médio | Closed beta detecta problemas. Checklist de policy review antes de submeter. |
| Trial não liberado na primeira submissão | Média | Baixo | Plano B: lançar sem trial, adicionar depois. |
| Algo dar errado no web em produção | Baixa | **Crítico** | **Nada no projeto Vercel atual é tocado.** Endpoint `/api/parse-circuit` vai em deploy Vercel novo separado. |

---

## 10. Decisões pendentes

| Item | Status | Ação |
|---|---|---|
| Nome "MarcaRota" — Play Store | ✅ Livre | Nenhum app conflitante encontrado |
| Nome "MarcaRota" — domínio `.com.br` | ⚠️ Confirmar manualmente | https://registro.br/painel |
| Nome "MarcaRota" — domínio `.com`/`.app` | ⚠️ Confirmar manualmente | https://namecheap.com ou https://porkbun.com |
| Nome "MarcaRota" — INPI (classes 9 e 39) | ⚠️ Confirmar manualmente | https://busca.inpi.gov.br/pePI |
| Ícone do app + identidade visual | A fazer | Pode usar Adobe Express / Canva grátis pra começar |
| Conta Google Play Console | A criar | US$ 25 one-time, antes da Fase 4 |
| Conta RevenueCat | A criar | Grátis até US$ 2.5k MRR |
| URL de política de privacidade | A gerar | Modelo padrão (sem coleta sensível) |
| Conta Sentry | A criar | Plano free |
| 3 amigos entregadores pra beta | A alinhar | Antes da Fase 2 |

Se algum check de nome falhar, trocamos antes da Fase 4 — até lá, o nome é só interno.

---

## 11. Custo inicial

| Item | Valor |
|---|---|
| Google Play Console | US$ 25 one-time (~R$ 150) |
| RevenueCat | Grátis até US$ 2.5k MRR |
| Sentry | Grátis até 5k events/mês |
| EAS Build | Grátis até 30 builds/mês |
| Vercel (endpoint) | Grátis (hobby) |
| Domínio (opcional) | ~R$ 40/ano |
| **Total inicial** | **~R$ 150–200** |

Receita projetada: 10 assinantes × R$ 19,90 = R$ 199/mês após trial → cobre setup em 1 mês.

---

## 12. Fora de escopo do MVP

- iOS / Apple Developer
- Histórico de rotas / métricas para o entregador
- Sincronização entre dispositivos
- Multi-usuário / multi-rota simultânea
- Suporte a outros otimizadores além do Circuit/Spoke
- Suporte a outros marketplaces além da Shopee
- Analytics de produto (PostHog, Mixpanel)
- Modo escuro / temas
- Internacionalização

Esses itens podem virar fases 5+ após validação do MVP.
