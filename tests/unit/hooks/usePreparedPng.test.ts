import { act, renderHook } from '@testing-library/react';
import * as exporting from '../../../src/preview/export';
import { PREPARE_DELAY_MS, usePreparedPng } from '../../../src/hooks/usePreparedPng';
import type { Scene } from '../../../src/preview/scene';

const scene = (name: string) => ({ name }) as unknown as Scene;

describe('usePreparedPng (D-076)', () => {
  let rendered: { scene: Scene; resolve: (blob: Blob) => void; reject: (e: Error) => void }[];

  beforeEach(() => {
    vi.useFakeTimers();
    rendered = [];
    vi.spyOn(exporting, 'renderPng').mockImplementation(
      (s) =>
        new Promise<Blob>((resolve, reject) => {
          rendered.push({ scene: s as Scene, resolve, reject });
        }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const setup = (enabled = true) =>
    renderHook(
      (props: { scene: Scene; revision: string; enabled: boolean }) =>
        usePreparedPng(props.scene, props.revision, 'taavi-test.png', props.enabled),
      { initialProps: { scene: scene('a'), revision: 'a', enabled } },
    );

  async function finish(index: number, content = 'png') {
    await act(async () => {
      rendered[index]?.resolve(new Blob([content], { type: 'image/png' }));
      await Promise.resolve();
    });
  }

  it('renders nothing while disabled', () => {
    const { result } = setup(false);
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS * 3));
    expect(result.current).toEqual({ status: 'idle' });
    expect(rendered).toHaveLength(0);
  });

  it('renders the scene after the pause and offers it as a named PNG file', async () => {
    const { result } = setup();
    expect(result.current.status).toBe('preparing');
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS - 1));
    expect(rendered).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));
    expect(rendered.map((r) => r.scene)).toEqual([scene('a')]);

    await finish(0);
    expect(result.current.status).toBe('ready');
    if (result.current.status !== 'ready') return;
    expect(result.current.file.name).toBe('taavi-test.png');
    expect(result.current.file.type).toBe('image/png');
    await expect(result.current.file.text()).resolves.toBe('png');
  });

  it('renders once after a burst of changes', () => {
    const { rerender } = setup();
    for (const revision of ['b', 'c', 'd']) {
      act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS / 2));
      rerender({ scene: scene(revision), revision, enabled: true });
    }
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.scene).toEqual(scene('d'));
  });

  it('withdraws the file as soon as the revision changes, never offering a stale image', async () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    await finish(0, 'old');
    expect(result.current.status).toBe('ready');

    rerender({ scene: scene('b'), revision: 'b', enabled: true });
    expect(result.current.status).toBe('preparing');

    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    await finish(1, 'new');
    expect(result.current.status === 'ready' && (await result.current.file.text())).toBe('new');
  });

  it('discards a render that finishes after its revision changed', async () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    rerender({ scene: scene('b'), revision: 'b', enabled: true });

    await finish(0, 'old');
    expect(result.current.status).toBe('preparing');
  });

  it('keeps the file when only the scene object changes (the note), without rendering again', async () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    await finish(0);

    rerender({ scene: scene('a with a note'), revision: 'a', enabled: true });
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS * 2));
    expect(result.current.status).toBe('ready');
    expect(rendered).toHaveLength(1);
  });

  it('reports a failed render', async () => {
    const { result } = setup();
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    await act(async () => {
      rendered[0]?.reject(new exporting.ExportError('encode'));
      await Promise.resolve();
    });
    expect(result.current).toEqual({ status: 'failed' });
  });

  it('is idle again once disabled', async () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(PREPARE_DELAY_MS));
    await finish(0);
    rerender({ scene: scene('a'), revision: 'a', enabled: false });
    expect(result.current).toEqual({ status: 'idle' });
  });
});
