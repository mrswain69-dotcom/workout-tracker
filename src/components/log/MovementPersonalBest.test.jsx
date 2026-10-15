// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import MovementPersonalBest from './MovementPersonalBest.jsx';
import { buildMovementPersonalBest } from '../../engine/movementPersonalBestEngine.js';
afterEach(cleanup);
it('renders an actual weighted PB, its date and the early-history reward requirement',()=>{
 const summary=buildMovementPersonalBest([{date:'2026-10-01',log:{blocks:[{typeId:'strength',movements:[{id:'bench'}],sets:{bench:[{weight:50,reps:12}]}}]}}],{id:'bench'},'2026-10-15');
 render(<MovementPersonalBest summary={summary}/>);
 expect(screen.getByRole('region',{name:'Current personal best'})).toBeTruthy();
 expect(screen.getAllByText('50 kg × 12 reps')).toHaveLength(2);
 expect(screen.queryByText('Most reps in one set')).toBeNull();
 expect(screen.getByText('All-time PB')).toBeTruthy();
 expect(screen.getByRole('region',{name:'Recent best'})).toBeTruthy();
 expect(screen.getByText('How PB rewards work').closest('details').open).toBe(false);
 expect(screen.getAllByText('1 Oct 2026').map(node=>node.getAttribute('datetime'))).toEqual(['2026-10-01','2026-10-01']);
 expect(screen.getByText(/1\/3 earlier comparable dates/)).toBeTruthy();
 expect(screen.getByText(/Independent of chart range/)).toBeTruthy();
});
it('shows hold time and the once-per-day bonus after the baseline exists',()=>{
 render(<MovementPersonalBest summary={{records:[{kind:'hold',label:'Longest hold',value:95,date:'2026-10-14'}],priorDates:3,disabled:false}}/>);
 expect(screen.getByText('1m 35s')).toBeTruthy();
 expect(screen.getByText(/\+15 XP — once per day across all movements and Cardio/)).toBeTruthy();
});
it('does not promise a second daily award when a PB has already earned XP',()=>{
 render(<MovementPersonalBest summary={{records:[{kind:'reps',label:'Most reps in one set',value:31,date:'2026-10-15'}],priorDates:4,disabled:false}} alreadyAwarded/>);
 expect(screen.getByText(/Today’s \+15 PB XP has already been earned/)).toBeTruthy();
 expect(screen.queryByText(/Beat an established, like-for-like/)).toBeNull();
});
it('handles missing or deliberately excluded results visibly',()=>{
 const {rerender}=render(<MovementPersonalBest summary={{records:[],priorDates:0,disabled:false}}/>);
 expect(screen.getByText(/No comparable PB recorded yet/)).toBeTruthy();
 rerender(<MovementPersonalBest summary={{records:[],priorDates:0,disabled:true}}/>);
 expect(screen.getByText(/PB tracking and PB rewards are off/)).toBeTruthy();
});
it('shows an exact-distance Cardio PB with its time and comparison scope',()=>{
 render(<MovementPersonalBest summary={{records:[{kind:'cardio',label:'Fastest recorded time',distanceKm:5,value:1740,date:'2026-10-14'}],priorDates:3,disabled:false,comparison:'cardio'}}/>);
 expect(screen.getByText('5 km in 29m 0s')).toBeTruthy();
 expect(screen.getByText(/Cardio PBs compare the same sport and exact recorded distance/)).toBeTruthy();
});

it('shows current-load evidence separately and explains an empty recent window',()=>{
 render(<MovementPersonalBest summary={{records:[{kind:'weighted',label:'Heaviest set',weight:100,reps:8,unit:'kg',date:'2026-03-09'}],currentRecords:[{kind:'weighted',label:'Best at your current load',weight:50,reps:15,unit:'kg',date:'2026-08-01'}],recentRecords:[],priorDates:4,disabled:false}}/>);
 expect(screen.getByRole('region',{name:'Best at your current load'}).textContent).toContain('50 kg × 15 reps');
 expect(screen.getByRole('region',{name:'Recent best'}).textContent).toContain('No comparable results in the last 30 days.');
});
