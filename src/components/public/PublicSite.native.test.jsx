// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PublicSite from './PublicSite.jsx';
vi.mock('../../native/platform.js',()=>({isNativeApp:()=>true}));
afterEach(cleanup);
it('opens native users at the account form with legal information available',()=>{
 render(<PublicSite><form aria-label="Account form"><input aria-label="Email"/></form></PublicSite>);
 expect(screen.getByRole('form',{name:'Account form'})).toBeTruthy();
 expect(screen.queryByRole('navigation',{name:'Public site navigation'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Privacy'}));
 expect(screen.getByRole('dialog',{name:'privacy'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Close legal information'}));
 fireEvent.click(screen.getByRole('button',{name:'Terms'}));
 expect(screen.getByRole('dialog',{name:'terms'})).toBeTruthy();
});
