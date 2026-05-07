/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '../select';

// Mock @/lib/utils
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('Select components', () => {
  it('should render SelectTrigger', () => {
    render(
      React.createElement(
        Select,
        { defaultValue: 'a' },
        React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
        React.createElement(SelectContent, null,
          React.createElement(SelectItem, { value: 'a' }, 'Option A')
        )
      )
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should render SelectItem with value', () => {
    render(
      React.createElement(
        Select,
        { defaultValue: 'b' },
        React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
        React.createElement(SelectContent, null,
          React.createElement(SelectItem, { value: 'a' }, 'Option A'),
          React.createElement(SelectItem, { value: 'b' }, 'Option B')
        )
      )
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('should render with item-select="popper" position', () => {
    const { container } = render(
      React.createElement(
        Select,
        { defaultValue: 'a' },
        React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
        React.createElement(SelectContent, { position: 'popper' },
          React.createElement(SelectItem, { value: 'a' }, 'Option A')
        )
      )
    );
    expect(container).toBeInTheDocument();
  });

  it('should render with default position (item-aligned)', () => {
    const { container } = render(
      React.createElement(
        Select,
        { defaultValue: 'a' },
        React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
        React.createElement(SelectContent, { position: 'item-aligned' },
          React.createElement(SelectItem, { value: 'a' }, 'Option A')
        )
      )
    );
    expect(container).toBeInTheDocument();
  });

  it('should render SelectGroup with SelectLabel', () => {
    const { container } = render(
      React.createElement(
        Select,
        { defaultValue: 'a' },
        React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
        React.createElement(SelectContent, null,
          React.createElement(SelectGroup, null,
            React.createElement(SelectLabel, null, 'Group 1'),
            React.createElement(SelectItem, { value: 'a' }, 'Option A')
          )
        )
      )
    );
    expect(container).toBeInTheDocument();
  });

  it('should render SelectSeparator', () => {
    const { container } = render(
      React.createElement(
        Select,
        { defaultValue: 'a' },
        React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
        React.createElement(SelectContent, null,
          React.createElement(SelectItem, { value: 'a' }, 'Option A'),
          React.createElement(SelectSeparator, null),
          React.createElement(SelectItem, { value: 'b' }, 'Option B')
        )
      )
    );
    expect(container).toBeInTheDocument();
  });
});
