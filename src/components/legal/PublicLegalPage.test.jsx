// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PublicLegalPage, { publicLegalPage } from './PublicLegalPage.jsx';

afterEach(cleanup);

it.each(['/privacy', '/terms', '/cookies', '/delete-account', '/support'])('opens %s without an account or authentication dependency', path => {
  render(<PublicLegalPage page={publicLegalPage(path)} />);
  expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to Workout Tracker' }).getAttribute('href')).toBe('/');
});

it('provides a prominent external deletion request and the existing in-app steps', () => {
  render(<PublicLegalPage page={publicLegalPage('/delete-account')} />);
  expect(screen.getByRole('link', { name: 'Email an account deletion request' }).getAttribute('href')).toMatch(/^mailto:support@workouttrackerapp.io\?subject=/);
  expect(screen.getByText(/enter your password and type DELETE/)).toBeTruthy();
  expect(screen.getByText(/Never send your password/)).toBeTruthy();
});

it('accepts trailing slashes and leaves app and unknown routes to the application', () => {
  expect(publicLegalPage('/privacy/')).toBe(publicLegalPage('/privacy'));
  for (const path of ['/', '/privacy-extra', '/groups']) expect(publicLegalPage(path)).toBeNull();
});
