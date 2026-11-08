import type { Catalog } from '../domain';

/**
 * Raw catalog definitions. Access the catalog through `getCatalog()`
 * (src/catalog/index.ts), never by importing this module directly.
 *
 * Contains only what Taavi has supplied: the four current models with their
 * customer-facing names and size labels, and the fixed ceramic color "Bege"
 * (D-040, D-041). The IDs are provisional until confirmed with Taavi and, once
 * confirmed, must never be renamed without a migration note. Everything else is
 * pending and must not be invented: no photographs or placement (`image`
 * omitted), no physical dimensions, and no frames. No model is declared to
 * accept an additional frame until that is confirmed.
 * Every change must keep `validateCatalog` passing (tests/unit/catalog).
 */
export const catalogData: Catalog = {
  plates: [
    {
      id: 'placa-ceramica-10',
      type: 'plate',
      displayName: 'Placa cerâmica',
      sizeLabel: '10 cm x 10 cm',
      ceramicColor: 'Bege',
      shape: 'square',
      supportsFrame: false,
      dimensions: { status: 'pending' },
    },
    {
      id: 'quadro-20',
      type: 'plate',
      displayName: 'Quadro',
      sizeLabel: '20 cm x 20 cm',
      ceramicColor: 'Bege',
      shape: 'square',
      supportsFrame: false,
      dimensions: { status: 'pending' },
    },
    {
      id: 'bandeja-ondulada-m-8',
      type: 'plate',
      displayName: 'Bandeja ondulada M',
      sizeLabel: '~ 8 cm',
      ceramicColor: 'Bege',
      shape: 'scalloped',
      supportsFrame: false,
      dimensions: { status: 'pending' },
    },
    {
      id: 'bandeja-ondulada-m-11',
      type: 'plate',
      displayName: 'Bandeja ondulada M',
      sizeLabel: '~ 11 cm',
      ceramicColor: 'Bege',
      shape: 'scalloped',
      supportsFrame: false,
      dimensions: { status: 'pending' },
    },
  ],
  frames: [],
  // The approved lettering palette has not been supplied (P-02); nothing is invented.
  textColors: [],
};
