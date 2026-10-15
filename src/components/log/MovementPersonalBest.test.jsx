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
 expect(screen.getByText('50 kg × 12 reps')).toBeTruthy();
 expect(screen.getByText('1 Oct 2026').getAttribute('datetime')).toBe('2026-10-01');
 expect(screen.getByText(/1\/3 earlier comparable dates/)).toBeTruthy();
 expect(screen.getByText(/independent of chart range/)).toBeTruthy();
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
