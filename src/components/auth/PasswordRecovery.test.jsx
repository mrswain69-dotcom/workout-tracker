// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PasswordRecovery from './PasswordRecovery.jsx';
import { updatePassword } from '../../db.js';
vi.mock('../../db.js',()=>({updatePassword:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('keeps recovery open after an API failure and completes only after confirmation',async()=>{
 updatePassword.mockResolvedValueOnce({error:new Error('Expired link')}).mockResolvedValueOnce({error:null});
 const done=vi.fn();render(<PasswordRecovery onComplete={done}/>);
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'newpassword1'}});
 fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'newpassword1'}});
 fireEvent.click(screen.getByText('Save new password'));
 await screen.findByRole('alert');expect(done).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Save new password'));await waitFor(()=>expect(done).toHaveBeenCalledOnce());
});
it('rejects mismatched passwords without sending a request',async()=>{
 render(<PasswordRecovery/>);
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'newpassword1'}});
 fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'newpassword2'}});
 fireEvent.click(screen.getByText('Save new password'));
 expect(screen.getByRole('alert').textContent).toContain('do not match');expect(updatePassword).not.toHaveBeenCalled();
});
