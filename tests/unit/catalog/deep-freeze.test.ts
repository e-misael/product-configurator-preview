import { deepFreeze } from '../../../src/catalog/deep-freeze';
import { at, buildImageCatalog, buildValidCatalog } from '../domain/catalog-fixtures';

/**
 * Mutation attempts go through `Reflect` so they compile despite the
 * `readonly` types: this proves runtime immutability, not just type safety.
 */
function expectAssignmentRejected(target: object, key: string, value: unknown) {
  const before: unknown = Reflect.get(target, key);
  expect(Reflect.set(target, key, value)).toBe(false);
  expect(Reflect.get(target, key)).toBe(before);
}

function expectPushRejected(list: readonly unknown[], value: unknown) {
  expect(() => Reflect.apply(Array.prototype.push, list, [value])).toThrow(TypeError);
}

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected fixture value to be defined');
  return value;
}

describe('deepFreeze', () => {
  it('returns the same instance', () => {
    const input = buildValidCatalog();
    expect(deepFreeze(input)).toBe(input);
  });

  it('freezes the catalog root and its collections', () => {
    const catalog = deepFreeze(buildValidCatalog());

    expect(Object.isFrozen(catalog)).toBe(true);
    expectAssignmentRejected(catalog, 'plates', []);
    expectPushRejected(catalog.plates, {});
    expectPushRejected(catalog.textColors, {});
  });

  it('freezes component objects', () => {
    const catalog = deepFreeze(buildValidCatalog());
    const plate = at(catalog.plates, 0);

    expect(Object.isFrozen(plate)).toBe(true);
    expect(Object.isFrozen(at(catalog.textColors, 0))).toBe(true);
    expectAssignmentRejected(plate, 'displayName', 'changed');
    expectAssignmentRejected(plate, 'ceramicColor', 'changed');
  });

  it('freezes the shape and lettering colors', () => {
    const catalog = deepFreeze(buildValidCatalog());

    expectAssignmentRejected(at(catalog.plates, 0), 'shape', 'circle');
    expectAssignmentRejected(at(catalog.textColors, 0), 'hex', '#000000');
  });

  it('freezes dimension and asset objects', () => {
    const catalog = deepFreeze(buildImageCatalog());
    const plate = at(catalog.plates, 0);

    expect(Object.isFrozen(plate.dimensions)).toBe(true);
    expectAssignmentRejected(plate.dimensions, 'widthMm', 1);
    expectAssignmentRejected(plate, 'dimensions', { status: 'pending' });
  });

  it('freezes model imagery and placement metadata', () => {
    const catalog = deepFreeze(buildImageCatalog());
    const plateImage = defined(at(catalog.plates, 0).image);

    expectAssignmentRejected(plateImage, 'image', undefined);
    expectAssignmentRejected(plateImage.image, 'src', '/catalog/plates/x/y.png');
    expectAssignmentRejected(plateImage.image, 'widthPx', 1);
    expectAssignmentRejected(defined(plateImage.objectBounds), 'x', 0.5);
    expectAssignmentRejected(defined(plateImage.text).area, 'width', 0.1);
    expectAssignmentRejected(defined(plateImage.text), 'align', 'left');
  });

  it('freezes shared references and is idempotent', () => {
    const shared = { status: 'pending' };
    const nested = { values: [1, 2] };
    const value = { a: shared, b: [shared, nested] };

    deepFreeze(value);
    deepFreeze(value);

    expect(Object.isFrozen(shared)).toBe(true);
    expect(Object.isFrozen(value.b)).toBe(true);
    expect(Object.isFrozen(nested.values)).toBe(true);
  });

  it('handles cyclic references', () => {
    const node: { self?: object } = {};
    node.self = node;

    expect(() => deepFreeze(node)).not.toThrow();
    expect(Object.isFrozen(node)).toBe(true);
  });

  it('leaves primitives unchanged', () => {
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze(null)).toBeNull();
  });
});
