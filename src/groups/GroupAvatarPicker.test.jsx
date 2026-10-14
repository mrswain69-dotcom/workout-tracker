// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import GroupAvatarPicker from './GroupAvatarPicker.jsx';
import {withGroupCosmetics} from './groupIdentity.js';
afterEach(cleanup);
it('offers only supplied unlocked identities and saves a separate group choice', () => {
 const onSelect=vi.fn();
 const {container}=render(<GroupAvatarPicker avatarIds={['emoji_rocket']} membership={{}} onSelect={onSelect}/>);
 expect(container.querySelector('details').open).toBe(false);
 fireEvent.click(screen.getByText(/Group avatar/));
 fireEvent.click(screen.getByRole('button',{name:'Use Rocket in this group',hidden:true}));
 expect(onSelect).toHaveBeenCalledWith('emoji_rocket',null);
 expect(screen.queryByRole('button',{name:'Use Tiger in this group',hidden:true})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Use main avatar',hidden:true}));
 expect(onSelect).toHaveBeenLastCalledWith(null,null);
});
it('updates live identity while preserving recorded final results', () => {
 const rows=[{membership_id:'a',avatar_id:'old',xp:100}];
 const directory=[{membership_id:'a',avatar_id:'custom',sport_avatar_appearance:{edition:'paired_v2',variant:'female'}}];
 expect(withGroupCosmetics(rows,directory)[0]).toMatchObject({avatar_id:'custom',xp:100});
 expect(withGroupCosmetics(rows,directory,true)[0]).toMatchObject({avatar_id:'old',sport_avatar_appearance:null,xp:100});
 expect(rows[0].avatar_id).toBe('old');
});
