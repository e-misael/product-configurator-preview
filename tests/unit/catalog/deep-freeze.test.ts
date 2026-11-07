import { deepFreeze } from '../../../src/catalog/deep-freeze';
import { at, buildValidCatalog } from '../domain/catalog-fixtures';

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
    expectPushRejected(catalog.frames, {});
    expect(() => Reflect.apply(Array.prototype.pop, catalog.colors, [])).toThrow(TypeError);
  });

  it('freezes component objects', () => {
    const catalog = deepFreeze(buildValidCatalog());
    const plate = at(catalog.plates, 0);
    const color = at(catalog.colors, 0);

    expect(Object.isFrozen(plate)).toBe(true);
    expect(Object.isFrozen(at(catalog.frames, 0))).toBe(true);
    expect(Object.isFrozen(color)).toBe(true);
    expectAssignmentRejected(plate, 'displayName', 'changed');
    expectAssignmentRejected(color, 'category', 'colored');
  });

  it('freezes nested supported lists and compatibility arrays', () => {
    const catalog = deepFreeze(buildValidCatalog());
    const plate = at(catalog.plates, 0);
    const { compatibility } = at(catalog.frames, 1);

    expectPushRejected(plate.supportedShapes, 'square');
    expectPushRejected(plate.supportedColorCategories, 'nude');
    expectPushRejected(plate.supportedColorIds, 'test-color-x');
    expect(Object.isFrozen(compatibility)).toBe(true);
    expectAssignmentRejected(compatibility, 'plateIds', undefined);
    expectPushRejected(compatibility.shapes, 'rectangle');
    expectPushRejected(defined(compatibility.plateIds), 'test-plate-x');
  });

  it('freezes dimension and asset objects', () => {
    const catalog = deepFreeze(buildValidCatalog());
    const plate = at(catalog.plates, 0);
    const square = defined(plate.dimensions.square);
    const squareAsset = defined(plate.assets?.square);
    const swatch = defined(at(catalog.colors, 0).swatch);

    expectAssignmentRejected(plate.dimensions, 'rectangle', { status: 'pending' });
    expectAssignmentRejected(square, 'widthMm', 1);
    expectAssignmentRejected(defined(plate.assets), 'rectangle', { src: 'x' });
    expectAssignmentRejected(squareAsset, 'src', '');
    expectAssignmentRejected(swatch, 'src', '');
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
