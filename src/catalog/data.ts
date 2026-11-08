import type { Catalog } from '../domain';

/**
 * Raw catalog definitions. Access the catalog through `getCatalog()`
 * (src/catalog/index.ts), never by importing this module directly.
 *
 * Contains only what Taavi has supplied: the four current models with their
 * customer-facing names and size labels, and the fixed ceramic color "Bege"
 * (D-040, D-041, D-046). The Quadro is one complete product (ceramic plate in a
 * wooden frame), photographed assembled; there is no separate frame choice.
 * IDs must never be renamed without a migration note in docs/06-decisions.md
 * (`bandeja-ondulada-m-11` became `bandeja-ondulada-g-11` under D-046).
 * The Placa cerâmica (official name "Placa cerâmica (tamanho 10 x 10 cm)",
 * D-048, D-051) has Taavi's photograph with the lettering removed (D-050),
 * cropped to 640 × 640, and its measured placement; crop and placement are
 * approved for the first production iteration (M1.3b-1, D-053), with a fixed
 * lettering size (D-055).
 * Everything else is pending and must not be invented: no other photographs or
 * placement (`image` omitted) and no physical dimensions.
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
      dimensions: { status: 'pending' },
      image: {
        image: {
          src: '/catalog/plates/placa-ceramica-10/bege.png',
          alt: 'Placa cerâmica quadrada bege, sem texto',
          widthPx: 640,
          heightPx: 640,
        },
        objectBounds: { x: 0.0781, y: 0.0891, width: 0.8422, height: 0.8219 },
        // About 8% inside the plate edge, clear of the rounded rim. Fixed lettering
        // size: half the former starting size, 0.5 × 0.25 × 0.69 = 0.08625 of the
        // image width (55.2 px); an initial visual reference, not a mold measurement (D-055).
        text: {
          area: { x: 0.145, y: 0.155, width: 0.71, height: 0.69 },
          align: 'center',
          fontSize: 0.08625,
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
      dimensions: { status: 'pending' },
    },
    {
      id: 'bandeja-ondulada-m-8',
      type: 'plate',
      displayName: 'Bandeja ondulada M',
      sizeLabel: 'Aprox. 8 cm',
      ceramicColor: 'Bege',
      shape: 'scalloped',
      dimensions: { status: 'pending' },
    },
    {
      id: 'bandeja-ondulada-g-11',
      type: 'plate',
      displayName: 'Bandeja ondulada G',
      sizeLabel: 'Aprox. 11 cm',
      ceramicColor: 'Bege',
      shape: 'scalloped',
      dimensions: { status: 'pending' },
    },
  ],
  // Color names are approved (D-049) but no values are (P-02); nothing is invented.
  textColors: [],
};
