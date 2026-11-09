import { renderHook, waitFor } from '@testing-library/react';
import * as fontLoading from '../../../src/preview/font-loading';
import { useLetteringFont } from '../../../src/hooks/useLetteringFont';

describe('useLetteringFont (D-072)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports loading, then loaded', async () => {
    let resolve = () => {};
    vi.spyOn(fontLoading, 'isLetteringFontLoaded').mockReturnValue(false);
    vi.spyOn(fontLoading, 'loadLetteringFont').mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() => useLetteringFont('serif'));

    expect(result.current).toBe('loading');
    resolve();
    await waitFor(() => expect(result.current).toBe('loaded'));
  });

  it('reports an error when the files cannot be loaded', async () => {
    vi.spyOn(fontLoading, 'isLetteringFontLoaded').mockReturnValue(false);
    vi.spyOn(fontLoading, 'loadLetteringFont').mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useLetteringFont('sans-serif'));

    await waitFor(() => expect(result.current).toBe('error'));
  });

  it('is loaded at once for a family loaded before, without loading again', () => {
    vi.spyOn(fontLoading, 'isLetteringFontLoaded').mockReturnValue(true);
    const load = vi.spyOn(fontLoading, 'loadLetteringFont');
    const { result } = renderHook(() => useLetteringFont('serif'));

    expect(result.current).toBe('loaded');
    expect(load).not.toHaveBeenCalled();
  });
});
