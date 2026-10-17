// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import FocusedLogBlock from './FocusedLogBlock.jsx';
afterEach(cleanup);

// Reproduce the Log's natural next-incomplete fallback, which changes as soon
// as a cardio/duration result is positive. Use the actual shared block editor.
function LogHarness({ kind = 'Cardio', field = 'number' }) {
  const [value,setValue] = useState('');
  const [second,setSecond] = useState('');
  const [focused,setFocused] = useState('');
  const [savedRevision,setSavedRevision] = useState(0);
  const natural = Number(value)>0 ? 'next' : 'current';
  const isOpen = id => focused ? focused===id : natural===id;
  const toggle = id => setFocused(isOpen(id)?'__none__':id);
  return <>
    <output aria-label="Saved revision">{savedRevision}</output>
    <FocusedLogBlock key="current" label={kind} open={isOpen('current')} complete={Number(value)>0}
      onInteract={()=>setFocused('current')} onToggle={()=>toggle('current')}>
      <label>Time <input aria-label="Time" type={field} value={value} onChange={e=>setValue(e.target.value)}/></label>
      <label>Distance <input aria-label="Distance" type="number" value={second} onChange={e=>setSecond(e.target.value)}/></label>
      <button onClick={()=>setSavedRevision(v=>v+1)}>Simulate saved log refresh</button>
    </FocusedLogBlock>
    <FocusedLogBlock key="next" label="Next activity" open={isOpen('next')}
      onInteract={()=>setFocused('next')} onToggle={()=>toggle('next')}><input aria-label="Next result"/></FocusedLogBlock>
  </>;
}

it.each(['Cardio','Duration','Injury recovery'])('keeps %s mounted and focused through the first digit, later digits and deletion',kind=>{
 render(<LogHarness kind={kind}/>);
 const input=screen.getByRole('spinbutton',{name:'Time'});
 act(()=>input.focus());
 for (const value of ['1','14','14.5','','2','25']) {
   fireEvent.change(input,{target:{value}});
   expect(screen.getByRole('spinbutton',{name:'Time'})).toBe(input);
   expect(input.value).toBe(value);
   expect(document.activeElement).toBe(input);
   expect(screen.getByRole('button',{name:kind}).getAttribute('aria-expanded')).toBe('true');
   expect(screen.queryByRole('textbox',{name:'Next result'})).toBeNull();
 }
});
it('pins the editor for autofill/change events even when no focus event was dispatched',()=>{
 render(<LogHarness/>);
 const input=screen.getByRole('spinbutton',{name:'Time'});
 fireEvent.change(input,{target:{value:'1'}});
 expect(screen.getByRole('spinbutton',{name:'Time'})).toBe(input);
});
it('lets users move between cardio fields and keeps the edited block open after a saved-log refresh',()=>{
 render(<LogHarness/>);
 const time=screen.getByRole('spinbutton',{name:'Time'});act(()=>time.focus());
 fireEvent.change(time,{target:{value:'30'}});
 const distance=screen.getByRole('spinbutton',{name:'Distance'});act(()=>distance.focus());
 fireEvent.change(distance,{target:{value:'5.25'}});
 expect(document.activeElement).toBe(distance);
 fireEvent.click(screen.getByText('Simulate saved log refresh'));
 expect(screen.getByLabelText('Saved revision').textContent).toBe('1');
 expect(screen.getByRole('spinbutton',{name:'Time'}).value).toBe('30');
 expect(screen.getByRole('spinbutton',{name:'Distance'})).toBe(distance);
});
it('retains normal text editing and selection without replacing the input',()=>{
 render(<LogHarness field="text"/>);
 const input=screen.getByRole('textbox',{name:'Time'});act(()=>input.focus());
 fireEvent.change(input,{target:{value:'12'}});
 input.setSelectionRange(1,1);
 fireEvent.change(input,{target:{value:'152',selectionStart:2,selectionEnd:2}});
 expect(screen.getByRole('textbox',{name:'Time'})).toBe(input);
 expect(document.activeElement).toBe(input);expect(input.selectionStart).toBe(2);
});
it('still lets the user collapse an edited block and choose another block',()=>{
 render(<LogHarness/>);
 const input=screen.getByRole('spinbutton',{name:'Time'});act(()=>input.focus());
 fireEvent.change(input,{target:{value:'25'}});
 fireEvent.click(screen.getByRole('button',{name:'Cardio'}));
 expect(screen.queryByRole('spinbutton',{name:'Time'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Next activity'}));
 expect(screen.getByRole('textbox',{name:'Next result'})).toBeTruthy();
});
it('does not let completion-status checkboxes or the summary steal explicit navigation',()=>{
 const interact=[];const toggle=[];
 render(<FocusedLogBlock label="Recovery" open onInteract={()=>interact.push(true)} onToggle={()=>toggle.push(true)}><input aria-label="Recovery respected" type="checkbox"/></FocusedLogBlock>);
 const checkbox=screen.getByRole('checkbox');act(()=>checkbox.focus());fireEvent.click(checkbox);
 fireEvent.click(screen.getByRole('button',{name:'Recovery'}));
 expect(interact).toHaveLength(0);expect(toggle).toHaveLength(1);
});
it('pins notes and select fields as well as numeric entries',()=>{
 const interact=[];
 render(<FocusedLogBlock label="Session" open onInteract={()=>interact.push(true)}><textarea aria-label="Notes"/><select aria-label="Choice"><option>A</option><option>B</option></select></FocusedLogBlock>);
 act(()=>screen.getByRole('textbox').focus());
 act(()=>screen.getByRole('combobox').focus());
 expect(interact).toHaveLength(2);
});
