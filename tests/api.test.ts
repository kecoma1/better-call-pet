import { describe, it, expect, vi, beforeEach } from 'vitest';
const session = vi.hoisted(() => ({currentUser: null as null | {getIdToken: () => Promise<string>}}));
vi.mock('../src/firebase', () => ({currentWorkspaceUser: () => session.currentUser}));
import {api} from '../src/services/api';
beforeEach(() => {session.currentUser = null;});
describe('authenticated transport', () => {
  it('rejects requests before sending them when signed out', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    await expect(api('/workspace')).rejects.toThrow('Sign in');
    expect(network).not.toHaveBeenCalled();
  });
  it('shows server failures to the calling form', async () => {
    session.currentUser = {getIdToken: async () => 'test-id-token'};
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({error:'Provider unavailable'}), {status:503}));
    await expect(api('/receipts', {})).rejects.toThrow('Provider unavailable');
  });
  it('preserves network failures instead of returning a fake result', async () => {
    session.currentUser = {getIdToken: async () => 'test-id-token'};
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('Connection interrupted'));
    await expect(api('/workspace')).rejects.toThrow('Connection interrupted');
  });
});
