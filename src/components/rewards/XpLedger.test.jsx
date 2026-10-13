// @vitest-environment jsdom
import React from 'react';
import { expect, it, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import XpLedger from './XpLedger.jsx';
import XpRulesInfo from './XpRulesInfo.jsx';
afterEach(cleanup);
it('shows the rule boundary, Recovery/PB buckets and their explanations',()=>{
 render(<XpLedger rows={[{date:'2026-10-14',ruleVersion:4,personalBestXp:15,recoveryXp:5,progXp:3,progressionDetails:[{label:'run',kind:'cardio',percent:3.3333,xp:3}]},{date:'2026-10-13',ruleVersion:3}]} />);
 expect(screen.getByText(/Previous rules below/)).toBeTruthy();
 expect(screen.getByRole('columnheader',{name:'Recovery'})).toBeTruthy();
 expect(screen.getByRole('columnheader',{name:'PB'})).toBeTruthy();
 expect(screen.getByText(/run: 3.33% faster, 3 XP/)).toBeTruthy();
 expect(screen.getByText('v3')).toBeTruthy();expect(screen.getByText('v4')).toBeTruthy();
});
it('lets the user reach older dates without resetting their balance',()=>{
 const rows=Array.from({length:22},(_,i)=>({date:`2026-09-${String(30-i).padStart(2,'0')}`,runningTotalXp:100-i}));
 render(<XpLedger rows={rows}/>);
 expect(screen.queryByText('2026-09-09')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Show older XP dates'}));
 expect(screen.getByText('2026-09-09')).toBeTruthy();
});
it('explains the live revised rules, whole XP rounding and all PB levels',()=>{
 render(<XpRulesInfo/>);
 expect(screen.getByText(/Revised rules from 14 October 2026/)).toBeTruthy();
 expect(screen.getByText(/Pro 50, Champion 100, Elite 150 and Unreal 250/)).toBeTruthy();
 expect(screen.getByText(/round down to whole XP/)).toBeTruthy();
 expect(screen.getByText(/Previous rules/)).toBeTruthy();
});
