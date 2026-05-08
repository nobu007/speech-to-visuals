/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../button';

// Mock @/lib/utils
jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('Button', () => {
  it('should render as button element by default', () => {
    render(React.createElement(Button, null, 'Click me'));
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should render with default variant classes', () => {
    render(React.createElement(Button, null, 'Default'));
    const button = screen.getByRole('button');
    expect(button.className).toContain('inline-flex');
  });

  it('should render with destructive variant', () => {
    render(React.createElement(Button, { variant: 'destructive' }, 'Delete'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with outline variant', () => {
    render(React.createElement(Button, { variant: 'outline' }, 'Outline'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with secondary variant', () => {
    render(React.createElement(Button, { variant: 'secondary' }, 'Secondary'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with ghost variant', () => {
    render(React.createElement(Button, { variant: 'ghost' }, 'Ghost'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with link variant', () => {
    render(React.createElement(Button, { variant: 'link' }, 'Link'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with small size', () => {
    render(React.createElement(Button, { size: 'sm' }, 'Small'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with large size', () => {
    render(React.createElement(Button, { size: 'lg' }, 'Large'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with icon size', () => {
    render(React.createElement(Button, { size: 'icon' }, 'X'));
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(React.createElement(Button, { ref }, 'Ref'));
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('should pass additional props to button', () => {
    render(React.createElement(Button, { disabled: true }, 'Disabled'));
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should render with asChild using Slot', () => {
    const { container } = render(
      React.createElement(
        Button,
        { asChild: true },
        React.createElement('a', { href: '/test' }, 'Link Button')
      )
    );
    // When asChild is true, it should render the child element, not a button
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link?.textContent).toBe('Link Button');
  });
});
