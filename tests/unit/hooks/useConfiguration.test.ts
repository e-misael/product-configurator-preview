import { act, renderHook } from '@testing-library/react';
import { issueFor, useConfiguration } from '../../../src/hooks/useConfiguration';
import { testCatalog } from '../domain/fixtures';

function setup() {
  return renderHook(() => useConfiguration(testCatalog));
}

describe('useConfiguration', () => {
  it('starts empty and incomplete', () => {
    const { result } = setup();

    expect(result.current.config).toEqual({
      plateId: null,
      frameId: null,
      text: '',
    });
    expect(result.current.validation.status).toBe('incomplete');
    expect(result.current.notice).toBeNull();
  });

  it('reaches a valid configuration through its actions', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.chooseFrame('test-frame-any'));
    act(() => result.current.setText('  Linha 1\nLinha 2 '));

    expect(result.current.config).toEqual({
      plateId: 'test-plate-square',
      frameId: 'test-frame-any',
      text: '  Linha 1\nLinha 2 ',
    });
    expect(result.current.validation).toEqual({ status: 'valid' });
  });

  it('clears the frame on a frameless plate and raises a notice until the next change', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.chooseFrame('test-frame-any'));
    act(() => result.current.choosePlate('test-plate-circle'));

    expect(result.current.config.frameId).toBeNull();
    expect(result.current.notice).toBe('frame-cleared');

    act(() => result.current.setText('Ana'));
    expect(result.current.notice).toBeNull();
  });

  it('keeps a frame that becomes incompatible and reports it as invalid', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.chooseFrame('test-frame-square'));
    act(() => result.current.choosePlate('test-plate-rectangle'));

    expect(result.current.config.frameId).toBe('test-frame-square');
    expect(result.current.notice).toBeNull();
    expect(issueFor(result.current.validation, 'frameId')).toEqual({
      kind: 'invalid',
      field: 'frameId',
      code: 'incompatible-shape',
    });
  });
});

describe('issueFor', () => {
  it('returns undefined for a valid result', () => {
    expect(issueFor({ status: 'valid' }, 'plateId')).toBeUndefined();
  });
});
