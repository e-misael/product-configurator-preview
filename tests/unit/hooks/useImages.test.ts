import { act, renderHook } from '@testing-library/react';
import { useImages } from '../../../src/hooks/useImages';
import { FakeImage, installFakeImages } from '../support/fake-image';

const A = '/catalog/plates/test-plate-a/a.webp';
const B = '/catalog/plates/test-plate-a/b.webp';

beforeEach(() => {
  installFakeImages({ [A]: { width: 400, height: 300 }, [B]: { width: 100, height: 100 } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useImages', () => {
  it('requests each source once and reports nothing until it settles', () => {
    const { result } = renderHook(() => useImages([A, B]));

    expect(FakeImage.requestedSources).toEqual([A, B]);
    expect(result.current.size).toBe(0);
  });

  it('reports loaded images with their natural size', () => {
    const { result } = renderHook(() => useImages([A]));

    act(() => FakeImage.load(A));

    const state = result.current.get(A);
    expect(state?.status).toBe('loaded');
    expect(
      state?.status === 'loaded' && [state.image.naturalWidth, state.image.naturalHeight],
    ).toEqual([400, 300]);
  });

  it('reports a failed request as an error', () => {
    const { result } = renderHook(() => useImages([A]));

    act(() => FakeImage.fail(A));

    expect(result.current.get(A)).toEqual({ status: 'error' });
  });

  it('treats an image that loads with no size as an error', () => {
    const { result } = renderHook(() => useImages(['/catalog/plates/test-plate-a/unknown.webp']));

    act(() => FakeImage.load('/catalog/plates/test-plate-a/unknown.webp'));

    expect(result.current.get('/catalog/plates/test-plate-a/unknown.webp')).toEqual({
      status: 'error',
    });
  });

  it('keeps loaded images when the sources change', () => {
    const { result, rerender } = renderHook(({ sources }) => useImages(sources), {
      initialProps: { sources: [A] },
    });
    act(() => FakeImage.load(A));

    rerender({ sources: [B] });

    expect(result.current.get(A)?.status).toBe('loaded');
    expect(result.current.has(B)).toBe(false);
  });

  it('does not request anything for no sources', () => {
    renderHook(() => useImages([]));
    expect(FakeImage.requestedSources).toEqual([]);
  });

  it('ignores results that arrive after the sources changed', () => {
    const { result, rerender } = renderHook(({ sources }) => useImages(sources), {
      initialProps: { sources: [A] },
    });

    rerender({ sources: [B] });
    act(() => FakeImage.load(A));

    expect(result.current.has(A)).toBe(false);
  });
});
