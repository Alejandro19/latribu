import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Isotipo from '../components/ui/Isotipo';

describe('Isotipo', () => {
  it('renders the reduced form (one arc, opening down) below 40px', () => {
    const { container } = render(<Isotipo size={34} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
    expect(circles[0]).toHaveAttribute('r', '58');
    expect(circles[0]).toHaveAttribute('stroke-dasharray', '272 92');
    expect(circles[0]).toHaveAttribute('transform', 'rotate(-224.3 66 66)');
    expect(circles[1]).toHaveAttribute('r', '8');
  });

  it('renders the full form (two opposing arcs) at 40px and above', () => {
    const { container } = render(<Isotipo size={40} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
    // Exterior: abertura arriba.
    expect(circles[0]).toHaveAttribute('r', '62');
    expect(circles[0]).toHaveAttribute('stroke-dasharray', '329 60.6');
    expect(circles[0]).toHaveAttribute('transform', 'rotate(-61.9 66 66)');
    // Interior: abertura abajo — contrapuesta a la exterior.
    expect(circles[1]).toHaveAttribute('r', '47');
    expect(circles[1]).toHaveAttribute('stroke-dasharray', '250 45.3');
    expect(circles[1]).toHaveAttribute('transform', 'rotate(-242.3 66 66)');
    expect(circles[2]).toHaveAttribute('r', '6');
  });

  it('uses the thick stroke tier below 96px and the thin tier at 96px and above', () => {
    const small = render(<Isotipo size={64} />).container.querySelectorAll('circle');
    expect(small[0]).toHaveAttribute('stroke-width', '4');
    expect(small[1]).toHaveAttribute('stroke-width', '3.4');

    const large = render(<Isotipo size={118} />).container.querySelectorAll('circle');
    expect(large[0]).toHaveAttribute('stroke-width', '2.4');
    expect(large[1]).toHaveAttribute('stroke-width', '2');
  });

  it('never renders the inner ring in full gold — dual tone by default', () => {
    const { container } = render(<Isotipo size={118} />);
    const inner = container.querySelectorAll('circle')[1];
    expect(inner).toHaveAttribute('stroke', 'var(--eph-faint)');
  });

  it('renders the inner ring at reduced opacity gold when tone="mono"', () => {
    const { container } = render(<Isotipo size={118} tone="mono" />);
    const inner = container.querySelectorAll('circle')[1];
    expect(inner).toHaveAttribute('stroke', 'var(--eph-accent)');
    expect(inner).toHaveAttribute('stroke-opacity', '0.38');
  });
});
