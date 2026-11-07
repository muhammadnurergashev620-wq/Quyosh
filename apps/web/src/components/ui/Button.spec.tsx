import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ArrowRight, X } from 'lucide-react';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to a click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Yuborish</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables itself, announces busy state, and keeps the label in place (no width jump) while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Saqlash</Button>);
    const button = screen.getByRole('button', { name: 'Yuklanmoqda Saqlash' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveClass('is-loading');
    expect(screen.getByText('Saqlash')).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'ghost', 'danger', 'accent'] as const)('applies the %s variant and the default md size', (variant) => {
    render(<Button variant={variant}>Amal</Button>);
    expect(screen.getByRole('button')).toHaveClass('gm-button', `gm-button--${variant}`, 'gm-button--md');
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size', (size) => {
    render(<Button size={size}>Amal</Button>);
    expect(screen.getByRole('button')).toHaveClass(`gm-button--${size}`);
  });

  it('disabled button ignores clicks', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Yopiq</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Yopiq' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('icon-only button is square and named by aria-label', () => {
    render(<Button iconOnly variant="ghost" aria-label="Yopish"><X /></Button>);
    expect(screen.getByRole('button', { name: 'Yopish' })).toHaveClass('gm-button--icon');
  });

  it('full-width and icon + text CTA', () => {
    render(<Button fullWidth>Davom etish <ArrowRight /></Button>);
    const button = screen.getByRole('button', { name: 'Davom etish' });
    expect(button).toHaveClass('gm-button--full');
    expect(button.querySelector('.lucide-arrow-right')).not.toBeNull();
  });
});
