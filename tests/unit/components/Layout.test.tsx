import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { WIDE_LAYOUT_QUERY } from '../../../src/hooks/useWideLayout';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

/** Page order and the collapsible steps of the narrow layout (D-058). */

let wide = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  wide = false;
  listeners.clear();
  installFakeImages(previewSizes);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === WIDE_LAYOUT_QUERY ? wide : true,
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const user = userEvent.setup();
  render(<App catalog={previewCatalog} />);
  return { user };
}

const STEPS = ['Modelo e tamanho', 'Texto e cores', 'Posição do texto', 'Revisar personalização'];
const toggle = (title: string) => screen.getByRole('button', { name: title });
const region = (name: string) => screen.getByRole('region', { name });
const body = (title: string) => {
  const controls = toggle(title).getAttribute('aria-controls');
  const element = controls === null ? null : document.getElementById(controls);
  if (element === null) throw new Error(`No body for ${title}`);
  return element;
};
const settle = () => act(() => FakeImage.loadAll());

describe('layout (D-058)', () => {
  it('puts the preview first, then the four steps in order, with export last', () => {
    setup();
    const sections = [region('Pré-visualização'), ...STEPS.map((title) => region(title))];

    for (let i = 1; i < sections.length; i += 1) {
      const previous = sections[i - 1];
      const current = sections[i];
      if (!previous || !current) throw new Error('Missing section');
      expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    // Export is the last control of the page; the disclaimer comes before it, in the review.
    const review = region('Revisar personalização');
    // The review step is closed at first: include hidden controls.
    const exportButton = within(review).getByRole('button', {
      name: 'Exportar imagem',
      hidden: true,
    });
    const controls = screen.getAllByRole('button', { hidden: true });
    expect(controls.at(-1)).toBe(exportButton);
    expect(within(review).getByText(/A pré-visualização é ilustrativa/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continuar/ })).toBeNull();
  });

  it('shows one step at a time on narrow screens, starting with the model', async () => {
    const { user } = setup();

    expect(STEPS.map((title) => toggle(title).getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(body('Texto e cores')).not.toBeVisible();

    await user.click(toggle('Texto e cores'));
    expect(toggle('Modelo e tamanho')).toHaveAttribute('aria-expanded', 'false');
    expect(toggle('Texto e cores')).toHaveAttribute('aria-expanded', 'true');
    expect(body('Texto e cores')).toBeVisible();
    expect(body('Modelo e tamanho')).not.toBeVisible();

    // The open step can be closed too.
    await user.click(toggle('Texto e cores'));
    expect(STEPS.every((title) => toggle(title).getAttribute('aria-expanded') === 'false')).toBe(
      true,
    );
  });

  it('opens and closes steps with the keyboard', async () => {
    const { user } = setup();
    toggle('Posição do texto').focus();

    await user.keyboard('{Enter}');
    expect(toggle('Posição do texto')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(toggle('Posição do texto')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps every choice while its step is closed, and summarizes it in the heading', async () => {
    const { user } = setup();
    await user.click(
      within(screen.getByRole('group', { name: 'Modelo' })).getByRole('radio', {
        name: /^Test plate square /,
      }),
    );
    settle();
    await user.click(toggle('Texto e cores'));
    await user.type(screen.getByLabelText('Texto'), 'Ana{Enter}Luz');
    await user.click(
      within(screen.getByRole('group', { name: 'Cor do texto' })).getByRole('radio', {
        name: 'Test ink A',
      }),
    );
    await user.click(toggle('Posição do texto'));
    await user.click(screen.getByRole('radio', { name: 'Alinhar à direita' }));
    await user.click(screen.getByRole('button', { name: 'Inferior à esquerda' }));

    await user.click(toggle('Revisar personalização'));

    // Hidden, not unmounted: the values are still there.
    expect(body('Texto e cores')).not.toBeVisible();
    expect(screen.getByLabelText('Texto', { selector: 'textarea' })).toHaveValue('Ana\nLuz');
    expect(
      within(screen.getByRole('group', { name: 'Cor do texto', hidden: true })).getByRole('radio', {
        name: 'Test ink A',
        hidden: true,
      }),
    ).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Alinhar à direita', hidden: true })).toBeChecked();
    expect(toggle('Modelo e tamanho')).toHaveAccessibleDescription(/Concluído/);
    expect(toggle('Texto e cores')).toHaveAccessibleDescription('Concluído · “Ana” · Test ink A');
    expect(toggle('Posição do texto')).toHaveAccessibleDescription(
      'Concluído · inferior à esquerda',
    );
    expect(toggle('Revisar personalização')).toHaveAccessibleDescription(
      'Concluído · pronta para exportar',
    );
    expect(
      within(region('Revisar personalização')).getByRole('button', { name: 'Exportar imagem' }),
    ).toHaveAttribute('aria-disabled', 'false');
  });

  it('expands the preview while positioning, and leaves touch-move mode when closing', async () => {
    const { user } = setup();
    const preview = region('Pré-visualização');
    await user.click(
      within(screen.getByRole('group', { name: 'Modelo' })).getByRole('radio', {
        name: /^Test plate square /,
      }),
    );
    settle();
    await user.click(toggle('Texto e cores'));
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    expect(preview).toHaveClass('preview--active');
    expect(preview).not.toHaveClass('preview--expanded');

    await user.click(toggle('Posição do texto'));
    expect(preview).toHaveClass('preview--expanded');
    await user.click(screen.getByRole('radio', { name: 'Ajustar manualmente' }));
    expect(preview.querySelector('canvas')?.style.touchAction).toBe('none');

    // Closing the step leaves manual mode, so touch scrolls the page again.
    await user.click(toggle('Revisar personalização'));
    expect(preview).not.toHaveClass('preview--expanded');
    expect(preview.querySelector('canvas')?.style.touchAction).toBe('auto');
    await user.click(toggle('Posição do texto'));
    expect(screen.getByRole('radio', { name: 'Escolher posição' })).toBeChecked();
  });

  it('keeps focus on the activated header and focuses nothing else (WAI-ARIA accordion)', async () => {
    const { user } = setup();
    toggle('Texto e cores').focus();

    await user.keyboard('{Enter}');
    expect(toggle('Texto e cores')).toHaveFocus();
    expect(toggle('Texto e cores')).toHaveAttribute('aria-controls', 'step-text-body');
    expect(document.getElementById('step-text-body')).toBeVisible();
    expect(screen.getByLabelText('Texto')).not.toHaveFocus();

    await user.click(toggle('Revisar personalização'));
    expect(toggle('Revisar personalização')).toHaveFocus();
    // Each header is a button inside a level-2 heading.
    expect(toggle('Revisar personalização').parentElement?.tagName).toBe('H2');
  });

  it('scrolls only when the opened header is out of view or under the preview', async () => {
    const { user } = setup();
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    const heading = () => document.getElementById('step-review-heading');
    const at = (top: number) => {
      const element = heading();
      if (element) element.getBoundingClientRect = () => ({ top, bottom: top + 40 }) as DOMRect;
    };

    // jsdom: the window is 768 px tall; the header in view needs no scroll.
    at(300);
    await user.click(toggle('Revisar personalização'));
    expect(scroll).not.toHaveBeenCalled();

    await user.click(toggle('Revisar personalização'));
    at(-120);
    await user.click(toggle('Revisar personalização'));
    expect(scroll).toHaveBeenCalledTimes(1);
    // Reduced motion (the stub matches every other query): no smooth scrolling.
    expect(scroll).toHaveBeenLastCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('shows every step open, with plain headings, on wide screens', () => {
    wide = true;
    setup();

    expect(screen.queryByRole('button', { name: 'Texto e cores' })).toBeNull();
    for (const title of STEPS) {
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(title) })).toBeVisible();
    }
    expect(screen.getByLabelText('Texto')).toBeVisible();
    expect(region('Pré-visualização')).not.toHaveClass('preview--expanded');
  });

  it('switches layout when the screen width crosses the breakpoint', () => {
    setup();
    expect(toggle('Texto e cores')).toBeInTheDocument();

    wide = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(screen.queryByRole('button', { name: 'Texto e cores' })).toBeNull();
    expect(screen.getByLabelText('Texto')).toBeVisible();
  });
});
