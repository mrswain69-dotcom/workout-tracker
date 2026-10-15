// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../../adminUsage.js',()=>({getUsageAccess:vi.fn(),getUsageDashboard:vi.fn()}));
import { getUsageAccess,getUsageDashboard } from '../../adminUsage.js';
import AdminUsagePanel from './AdminUsagePanel.jsx';
afterEach(()=>{cleanup();vi.resetAllMocks();});
const report={generated_at:'2026-10-15T21:00:00Z',tracking_since:'2026-10-15T20:00:00Z',summary:{accounts:5,profiles:4},daily_signups:[{date:'2026-10-15',count:2}],accounts:[{email:'athlete@example.com',created_at:'2026-10-15T12:00:00Z',profiles:1,email_confirmed_at:'2026-10-15T13:00:00Z',activity_logs:0,activity_days:0}]};
it('renders nothing and fetches no figures for a non-admin',async()=>{
 getUsageAccess.mockResolvedValue(false);const {container}=render(<AdminUsagePanel/>);
 await waitFor(()=>expect(getUsageAccess).toHaveBeenCalledOnce());
 expect(container.textContent).toBe('');expect(getUsageDashboard).not.toHaveBeenCalled();
});
it('loads figures only when opened, and refreshes the include-admin filter',async()=>{
 getUsageAccess.mockResolvedValue(true);getUsageDashboard.mockResolvedValue(report);
 render(<AdminUsagePanel/>);
 const toggle=await screen.findByRole('button',{name:/Admin · Users/});
 expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(getUsageDashboard).not.toHaveBeenCalled();
 fireEvent.click(toggle);await screen.findByText('Accounts');
 expect(getUsageDashboard).toHaveBeenCalledWith(false);
 expect(screen.getByText('athlete@example.com')).toBeTruthy();
 expect(screen.getByText('No activity recorded')).toBeTruthy();
 fireEvent.click(screen.getByRole('checkbox',{name:'Include admin account'}));
 await waitFor(()=>expect(getUsageDashboard).toHaveBeenLastCalledWith(true));
 fireEvent.click(screen.getByRole('button',{name:'Refresh figures'}));
 await waitFor(()=>expect(getUsageDashboard).toHaveBeenCalledTimes(3));
});
it('shows a useful error and recovers on refresh',async()=>{
 getUsageAccess.mockResolvedValue(true);getUsageDashboard.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(report);
 render(<AdminUsagePanel/>);fireEvent.click(await screen.findByRole('button',{name:/Admin · Users/}));
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Refresh figures'}));
 await screen.findByText('Accounts');expect(screen.queryByRole('alert')).toBeNull();
});
