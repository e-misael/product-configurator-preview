import type { Catalog, PlateImage } from '../domain';

/**
 * The Bandejas ondulada M and G share one design, so they share one photograph
 * and its placement, stored once per model folder (D-054). Only the lettering
 * size differs: the same 7 mm letters cover less of the larger G (D-055).
 * Text area: the flat floor, clear of the wavy walls (M1.3b-2).
 */
function bandejaImage(id: string, fontSize: number): PlateImage {
  return {
    image: {
      src: `/catalog/plates/${id}/bege.jpg`,
      alt: 'Bandeja ondulada bege, sem texto',
      widthPx: 1060,
      heightPx: 1060,
    },
    objectBounds: { x: 0.0283, y: 0.0387, width: 0.9425, height: 0.9226 },
    text: { area: { x: 0.28, y: 0.265, width: 0.43, height: 0.43 }, align: 'center', fontSize },
  };
}

/**
 * Raw catalog definitions. Access the catalog through `getCatalog()`
 * (src/catalog/index.ts), never by importing this module directly.
 *
 * Contains only what Taavi has supplied: the four current models with their
 * customer-facing names, size labels, and confirmed outer dimensions, and the
 * fixed ceramic color "Bege" (D-040, D-041, D-046, P-01), and the approved
 * lettering colors (D-056). The Quadro is one
 * complete product (a 100 × 100 mm ceramic plate in a 200 × 200 mm wooden
 * frame), photographed assembled; there is no separate frame choice.
 * IDs must never be renamed without a migration note in docs/06-decisions.md
 * (`bandeja-ondulada-m-11` became `bandeja-ondulada-g-11` under D-046).
 * Every model has Taavi's photograph with the lettering removed (D-050, D-054)
 * and its measured placement (M1.3b-1, D-053; M1.3b-2).
 *
 * Lettering size (D-055): one fixed size per model, for a visible capital
 * about 7 mm tall (a provisional estimate, not a mold measurement):
 * fontSize = 7 mm × (ceramic width in the photograph ÷ its real width) ÷ 0.7046,
 * the capital height of the sans-serif stack as a fraction of the font size.
 * The ceramic width is `objectBounds.width`, except on the Quadro, whose
 * bounds are the frame: there it is the 100 mm ceramic, 282 of 660 px.
 * Every change must keep `validateCatalog` passing (tests/unit/catalog).
 */
export const catalogData: Catalog = {
  plates: [
    {
      id: 'placa-ceramica-10',
      type: 'plate',
      displayName: 'Placa cerâmica',
      sizeLabel: '10 × 10 cm',
      ceramicColor: 'Bege',
      shape: 'square',
      dimensions: { status: 'defined', widthMm: 100, heightMm: 100 },
      image: {
        image: {
          src: '/catalog/plates/placa-ceramica-10/bege.png',
          alt: 'Placa cerâmica quadrada bege, sem texto',
          widthPx: 640,
          heightPx: 640,
        },
        objectBounds: { x: 0.0781, y: 0.0891, width: 0.8422, height: 0.8219 },
        // About 8% inside the plate edge, clear of the rounded rim.
        // Lettering: 7 × (0.8422 / 100) / 0.7046 = 0.0837 (53.6 px).
        text: {
          area: { x: 0.145, y: 0.155, width: 0.71, height: 0.69 },
          align: 'center',
          fontSize: 0.0837,
        },
      },
    },
    {
      id: 'quadro-20',
      type: 'plate',
      displayName: 'Quadro',
      sizeLabel: '20 × 20 cm',
      ceramicColor: 'Bege',
      shape: 'square',
      // Outside of the frame; the ceramic inside measures 100 × 100 mm.
      dimensions: { status: 'defined', widthMm: 200, heightMm: 200 },
      image: {
        image: {
          src: '/catalog/plates/quadro-20/bege.jpg',
          alt: 'Quadro: placa cerâmica bege em moldura de madeira, sem texto',
          widthPx: 660,
          heightPx: 660,
        },
        // The whole product, frame included.
        objectBounds: { x: 0.0364, y: 0.0318, width: 0.9273, height: 0.9364 },
        // On the ceramic only, about 8% inside its edge, never on the wood.
        // Lettering from the 100 mm ceramic (282 of 660 px), not the frame:
        // 7 × (282 / 660 / 100) / 0.7046 = 0.0424 (28.0 px).
        text: {
          area: { x: 0.3009, y: 0.3494, width: 0.3589, height: 0.3589 },
          align: 'center',
          fontSize: 0.0424,
        },
      },
    },
    {
      id: 'bandeja-ondulada-m-8',
      type: 'plate',
      displayName: 'Bandeja ondulada M',
      sizeLabel: '8 × 8 cm',
      ceramicColor: 'Bege',
      shape: 'scalloped',
      dimensions: { status: 'defined', widthMm: 80, heightMm: 80 },
      // 7 × (0.9425 / 80) / 0.7046 = 0.1170 (124.0 px).
      image: bandejaImage('bandeja-ondulada-m-8', 0.117),
    },
    {
      id: 'bandeja-ondulada-g-11',
      type: 'plate',
      displayName: 'Bandeja ondulada G',
      sizeLabel: '11 × 11 cm',
      ceramicColor: 'Bege',
      shape: 'scalloped',
      dimensions: { status: 'defined', widthMm: 110, heightMm: 110 },
      // 7 × (0.9425 / 110) / 0.7046 = 0.0851 (90.2 px).
      image: bandejaImage('bandeja-ondulada-g-11', 0.0851),
    },
  ],
  // First production palette (D-056), in the approved display order. Amarelo
  // queimado is pending visual approval and Laranja is excluded for now; neither
  // is listed. Every color may also be the second color, never equal to the first.
  textColors: [
    { id: 'marrom', type: 'text-color', displayName: 'Marrom', hex: '#4a2a14' },
    { id: 'azul', type: 'text-color', displayName: 'Azul', hex: '#2b4a7a' },
    { id: 'verde', type: 'text-color', displayName: 'Verde', hex: '#2f4a36' },
    { id: 'vermelho-escuro', type: 'text-color', displayName: 'Vermelho escuro', hex: '#7a1f1f' },
  ],
  // Selected when the configurator opens (product owner, 2026-11-08, D-064).
  defaultTextColorId: 'marrom',
};
