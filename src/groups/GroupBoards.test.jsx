// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('./GroupWeeklyXp.jsx',()=>({default:props=><div>Weekly XP {props.periodMode}</div>}));
vi.mock('./GroupConsistency.jsx',()=>({default:props=><div>Weekly discipline {props.periodMode}</div>}));
vi.mock('./GroupImprovement.jsx',()=>({default:props=><div>Weekly improvement {props.periodMode}</div>}));
vi.mock('./GroupSeasons.jsx',()=>({default:props=><div>{props.display==='awards' ? 'Awards panel' : `${props.boardMetric} ${props.boardPeriod} standings`}</div>}));
vi.mock('./GroupChallenges.jsx',()=>({default:()=> <div>Challenges panel</div>}));
vi.mock('./GroupTeamView.jsx',()=>({default:()=> <div>Team panel</div>}));
import GroupBoards from './GroupBoards.jsx';
afterEach(cleanup);
it('keeps one board in view and carries the selected period between metrics',()=>{
 render(<GroupBoards group={{group_type:'private'}} membership={{id:'m'}} />);
 expect(screen.getByText('Weekly XP current')).toBeTruthy();
 expect(screen.queryByText('Challenges panel')).toBeNull();
 fireEvent.change(screen.getByRole('combobox',{name:'Leaderboard period'}),{target:{value:'month'}});
 expect(screen.getByText('xp month standings')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Discipline'}));
 expect(screen.getByText('consistency month standings')).toBeTruthy();
 expect(screen.queryByText('xp month standings')).toBeNull();
 fireEvent.change(screen.getByRole('combobox',{name:'Leaderboard period'}),{target:{value:'season'}});
 expect(screen.getByText('consistency season standings')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Awards'}));
 expect(screen.getByText('Awards panel')).toBeTruthy();
 expect(screen.queryByRole('combobox',{name:'Leaderboard period'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Challenges'}));
 expect(screen.getByText('Challenges panel')).toBeTruthy();
});
it('keeps team performance available only to squads and clubs',()=>{
 const {rerender}=render(<GroupBoards group={{group_type:'private'}} membership={{id:'m'}} />);
 expect(screen.queryByRole('button',{name:'Team'})).toBeNull();
 rerender(<GroupBoards group={{group_type:'squad'}} membership={{id:'m'}} />);
 fireEvent.click(screen.getByRole('button',{name:'Team'}));
 expect(screen.getByText('Team panel')).toBeTruthy();
});
