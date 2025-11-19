import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple component to test
const HelloWorld = ({ name }: { name: string }) => (
  <div>Hello {name}</div>
);

describe('HelloWorld', () => {
  it('renders the name', () => {
    render(<HelloWorld name="World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
