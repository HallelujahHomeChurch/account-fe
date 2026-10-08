import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/auth-context'
import { LocaleProvider } from '../../i18n/locale-context'
import { OperationsApiError } from '../../lib/operations-api'
import type { ServiceAssignment } from '../../lib/member-service-api'
import { ServiceDetail } from './ServiceDetail'
vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
const item = { id:'one',teamId:'team',teamName:'Worship',label:'Lead worship',assigneeMemberId:'peer',startsAt:'2030-01-01T01:00:00Z',endsAt:'2030-01-01T02:00:00Z',timeZone:'Asia/Taipei',meetingName:'Sunday',version:3,request:{id:'request',mode:'nominated',targetMemberId:'me',status:'active'} } as ServiceAssignment
const api = {getAssignment:vi.fn(),listCandidates:vi.fn(),command:vi.fn()}
const changed = vi.fn()
beforeEach(()=>{vi.clearAllMocks();api.getAssignment.mockResolvedValue(item);api.listCandidates.mockResolvedValue([]);api.command.mockResolvedValue({...item,version:4,assigneeMemberId:'me',request:{...item.request,status:'accepted'}});vi.mocked(useAuth).mockReturnValue({serviceApi:api} as never)})
function mount() { render(<LocaleProvider><ServiceDetail id="one" teams={[{id:'team',name:'Worship',memberId:'me',canManage:true}]} items={[]} zone="Asia/Taipei" onClose={()=>{}} onChanged={changed}/></LocaleProvider>) }
it('accepts an invitation with its version and request ID without exposing manager actions',async()=>{ mount();await userEvent.click(await screen.findByRole('button',{name:'Accept substitution'}));await userEvent.click(screen.getByRole('button',{name:'Confirm'}));await waitFor(()=>expect(changed).toHaveBeenCalled());expect(api.command).toHaveBeenCalledWith('one',{action:'accept',expectedVersion:3,requestId:'request'},expect.any(String));expect(screen.queryByText('Publish')).not.toBeInTheDocument() })
it('reuses the same key after an uncertain command failure',async()=>{api.command.mockRejectedValueOnce(new Error('network'));mount();await userEvent.click(await screen.findByRole('button',{name:'Accept substitution'}));await userEvent.click(screen.getByRole('button',{name:'Confirm'}));await waitFor(()=>expect(api.command).toHaveBeenCalledTimes(1));const dialog=screen.getByRole('dialog',{name:'Accept substitution'});expect(await within(dialog).findByRole('alert')).toBeInTheDocument();await userEvent.click(within(dialog).getByRole('button',{name:'Confirm'}));await waitFor(()=>expect(api.command).toHaveBeenCalledTimes(2));expect(api.command.mock.calls[0][2]).toBe(api.command.mock.calls[1][2])})
it('blocks stale commands until details have been reloaded',async()=>{api.command.mockRejectedValueOnce(new OperationsApiError(412,'stale'));mount();await userEvent.click(await screen.findByRole('button',{name:'Accept substitution'}));await userEvent.click(screen.getByRole('button',{name:'Confirm'}));expect(await screen.findByText('This assignment has changed. Review the latest details before trying again.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Accept substitution'})).toBeDisabled();await userEvent.click(screen.getByRole('button',{name:'Reload details'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Accept substitution'})).not.toBeDisabled())})
