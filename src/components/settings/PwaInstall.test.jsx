// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { createPwaInstallController } from '../../pwaInstall';
import { PwaInstallReminder, PwaInstallSettings } from './PwaInstall';

afterEach(cleanup);
function controllerFor(userAgent, standalone = false) {
  const win = new EventTarget();
  win.navigator = { userAgent, standalone };
  win.matchMedia = () => ({ matches: false });
  const storage = new Map();
  win.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const controller = createPwaInstallController(win);
  controller.start();
  return { controller, win, offer() {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn().mockResolvedValue({ outcome: 'dismissed' });
    act(() => win.dispatchEvent(event));
    return event;
  } };
}

describe('PWA install surfaces', () => {
  it('offers iPhone instructions in settings without a reminder or fake install button', () => {
    const { controller } = controllerFor('iPhone Safari');
    render(<><PwaInstallSettings controller={controller} /><PwaInstallReminder controller={controller} /></>);
    expect(screen.getByText('Install Workout Tracker')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Add to Home Screen' })).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'iPhone installation steps' }).children).toHaveLength(3);
    expect(screen.getByText('square with an arrow pointing up')).toBeTruthy();
    expect(screen.getByText('Edit Actions')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('provides phone help on desktop without any automatic reminder', () => {
    const test = controllerFor('Windows Chrome');
    render(<><PwaInstallSettings controller={test.controller} /><PwaInstallReminder controller={test.controller} /></>);
    test.offer();
    expect(screen.getByRole('button', { name: 'Install on this device' })).toBeTruthy();
    expect(screen.getByText('How to install on your phone')).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('dismisses the small phone reminder while keeping the settings button available', () => {
    const test = controllerFor('Android Mobile Chrome');
    render(<><PwaInstallSettings controller={test.controller} /><PwaInstallReminder controller={test.controller} /></>);
    test.offer();
    expect(screen.getByRole('complementary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByRole('button', { name: 'Install on your phone' })).toBeTruthy();
  });

  it('does not interrupt onboarding and invokes installation only on user action', async () => {
    const test = controllerFor('Android Mobile Chrome');
    const { rerender } = render(<PwaInstallReminder controller={test.controller} visible={false} />);
    const event = test.offer();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(event.prompt).not.toHaveBeenCalled();
    rerender(<PwaInstallReminder controller={test.controller} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Install app' })));
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('shows installed status without asking to install again', () => {
    const test = controllerFor('iPhone', true);
    render(<><PwaInstallSettings controller={test.controller} /><PwaInstallReminder controller={test.controller} /></>);
    expect(screen.getByRole('status').textContent).toContain('already using the installed app');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows manual help after the native prompt is cancelled', async () => {
    const test = controllerFor('Android Mobile');
    render(<PwaInstallSettings controller={test.controller} />);
    test.offer();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Install on your phone' })));
    expect(screen.getByRole('status').textContent).toContain('keep using the website');
    expect(screen.getByText('How to add it to your home screen').parentElement.open).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/normal Chrome tab/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'iPhone installation steps' })).toBeNull();
  });
});
