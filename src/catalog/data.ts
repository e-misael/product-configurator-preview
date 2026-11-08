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
 * Everything else is pending and must not be invented: no photographs or
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
  // The approved lettering palette has not been supplied (P-02); nothing is invented.
  textColors: [],
};
