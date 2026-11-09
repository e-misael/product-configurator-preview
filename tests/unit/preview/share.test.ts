import { canShareFiles, shareFile, whatsAppNumber, whatsAppUrl } from '../../../src/preview/share';

const png = () => new File(['png'], 'taavi-test.png', { type: 'image/png' });

function stubShare(
  share: (data: ShareData) => Promise<void>,
  canShare: (data: ShareData) => boolean = () => true,
) {
  const calls: ShareData[] = [];
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: (data: ShareData) => {
      calls.push(data);
      return share(data);
    },
  });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
  return calls;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
});

describe('canShareFiles (D-076)', () => {
  it('is false without the Web Share API', () => {
    expect(canShareFiles()).toBe(false);
    expect(canShareFiles(png())).toBe(false);
  });

  it('is false with share but without canShare', () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => undefined });
    expect(canShareFiles()).toBe(false);
  });

  it('asks canShare about a PNG, the given one when there is one', () => {
    const asked: ShareData[] = [];
    stubShare(
      () => Promise.resolve(),
      (data) => {
        asked.push(data);
        return data.files?.[0]?.name === 'taavi-test.png';
      },
    );

    expect(canShareFiles()).toBe(false);
    expect(asked[0]?.files?.[0]?.type).toBe('image/png');
    expect(canShareFiles(png())).toBe(true);
  });

  it('is false when canShare throws', () => {
    stubShare(
      () => Promise.resolve(),
      () => {
        throw new TypeError('bad data');
      },
    );
    expect(canShareFiles(png())).toBe(false);
  });
});

describe('shareFile (D-076)', () => {
  it('shares the file with the text when the browser accepts both, before returning', async () => {
    const calls = stubShare(() => Promise.resolve());
    const file = png();

    const pending = shareFile(file, 'Olá, TAAVI!');
    // Called synchronously: the click that called shareFile still counts as the activation.
    expect(calls).toEqual([{ files: [file], text: 'Olá, TAAVI!' }]);
    await expect(pending).resolves.toBe('shared');
  });

  it('shares the file alone when the text is not accepted with it', async () => {
    const calls = stubShare(
      () => Promise.resolve(),
      (data) => data.text === undefined,
    );
    const file = png();

    await expect(shareFile(file, 'Olá')).resolves.toBe('shared');
    expect(calls).toEqual([{ files: [file] }]);
  });

  it('reports a dismissed sheet as cancelled', async () => {
    stubShare(() => Promise.reject(new DOMException('dismissed', 'AbortError')));
    await expect(shareFile(png(), 'Olá')).resolves.toBe('cancelled');
  });

  it.each([
    ['without user activation', new DOMException('no activation', 'NotAllowedError')],
    ['when the data is refused', new TypeError('bad data')],
    ['on any other error', new DOMException('busy', 'InvalidStateError')],
  ])('fails %s, and does not try again', async (_, error) => {
    const calls = stubShare(() => Promise.reject(error));
    await expect(shareFile(png(), 'Olá')).resolves.toBe('failed');
    expect(calls).toHaveLength(1);
  });

  it('fails when share throws synchronously', async () => {
    stubShare(() => {
      throw new TypeError('sync');
    });
    await expect(shareFile(png(), 'Olá')).resolves.toBe('failed');
  });
});

describe('WhatsApp link (D-076)', () => {
  it.each([
    ['not configured', null, null],
    ['empty', '', null],
    ['with a plus sign', '+5511999999999', null],
    ['with spaces', '55 11 99999 9999', null],
    ['with a leading zero', '011999999999', null],
    ['too short', '1234567', null],
    ['too long', '1234567890123456', null],
    ['digits with country code', '5500000000000', '5500000000000'],
  ])('accepts only a valid number: %s', (_, value, expected) => {
    expect(whatsAppNumber(value)).toBe(expected);
  });

  it('opens the chat with the text typed in, every character encoded', () => {
    const text = 'Olá, TAAVI!\n\nModelo: Placa cerâmica — 10 × 10 cm\nTexto:\nA & B?\n#1 100%';
    const url = whatsAppUrl('5500000000000', text);

    expect(url.startsWith('https://wa.me/5500000000000?text=')).toBe(true);
    expect(new URL(url).searchParams.get('text')).toBe(text);
    expect(url.split('?text=')[1]).not.toMatch(/[ \n&#?]/);
  });
});
