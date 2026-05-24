# ⚡ Flash Pack

App web para entregadores que cruza o **QR Code do pacote** (SPX TN) com o **número da parada** da rota do Circuit. Você bipa o pacote e o número da parada aparece em letras gigantes — sem precisar procurar na lista.

## Como usar

1. No **Circuit**, abra a rota do dia (já otimizada).
2. Ao **exportar o PDF** da rota, marque a opção **SPX TN** na tela "Além das informações de endereço, selecione o que mais você quer ver ao chegar".
3. No Flash Pack, aba **Início**, carregue esse PDF.
4. Vá para **Scanner** e leia o QR Code de cada pacote — a parada aparece em destaque.

> Basta **um arquivo**: o PDF do Circuit já traz o número da parada, o endereço e o código SPX TN. Não é preciso a planilha da Shopee.

### Recursos

- **Scanner por câmera** e **busca** por código ou endereço.
- **Múltiplos pacotes no mesmo endereço:** ao bipar, mostra a parada do pacote em destaque e lista todas as paradas daquele endereço no formato `01/02/03`.
- **Aviso** quando o PDF foi exportado sem a coluna SPX TN.

## Desenvolvimento

```bash
npm install     # instala dependências
npm run dev     # servidor de desenvolvimento (HTTPS, exigido pela câmera)
npm run build   # build de produção
npm run test    # testes (vitest)
npm run lint    # eslint
```

Stack: React + Vite. Leitura de PDF com `pdfjs-dist`; leitura de QR com `html5-qrcode`.

## Estrutura

- `src/utils/parseCircuit.js` — extrai paradas (nº, endereço, SPX TN) do PDF do Circuit.
- `src/utils/matchPackages.js` — monta a lista de pacotes e agrupa paradas do mesmo endereço.
- `src/components/Upload.jsx` — importação do PDF.
- `src/components/Scanner.jsx` — câmera e busca.
- `src/components/PackageList.jsx` — lista de pacotes da rota.
