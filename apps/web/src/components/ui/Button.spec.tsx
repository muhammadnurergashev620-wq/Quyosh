import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to a click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Yuborish</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables itself, announces busy state, and keeps the label reachable for screen readers while loading', () => {
    render(<Button loading>Saqlash</Button>);
    const button = screen.getByRole('button', { name: 'Yuklanmoqda Saqlash' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
