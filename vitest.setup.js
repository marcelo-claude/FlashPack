// pdfjs-dist toca globais de browser ao ser importado (DOMMatrix, etc).
// O parseCircuit.js importa pdfjs no topo, então só de importar o módulo
// para testar as funções puras precisamos desses stubs no ambiente Node.
class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0
  }
}
if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = DOMMatrix
if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = class Path2D {}
if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = class ImageData {}
