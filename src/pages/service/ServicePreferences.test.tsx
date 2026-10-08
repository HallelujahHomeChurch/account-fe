import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/auth-context'
import { LocaleProvider } from '../../i18n/locale-context'
import { OperationsApiError } from '../../lib/operations-api'
import { ServicePreferences } from './ServicePreferences'
vi.mock('../../auth/auth-context',()=>({useAuth:vi.fn()}))
const pref={enabled:true,leadDays:1,localTime:'19:00',timeZone:'Asia/Taipei',version:7}
const api={getPreference:vi.fn(),updatePreference:vi.fn()}
beforeEach(()=>{vi.clearAllMocks();api.getPreference.mockResolvedValue(pref);api.updatePreference.mockResolvedValue({...pref,enabled:false,version:8});vi.mocked(useAuth).mockReturnValue({serviceApi:api} as never)})
function mount(){render(<MemoryRouter><LocaleProvider><ServicePreferences/></LocaleProvider></MemoryRouter>)}
it('saves the exact displayed version without implying native delivery',async()=>{mount();await userEvent.click(await screen.findByRole('switch',{name:'Service reminder'}));await userEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByText('Saved');expect(api.updatePreference).toHaveBeenCalledWith({...pref,enabled:false})})
it('requires reload after a conflicting preference change',async()=>{api.updatePreference.mockRejectedValueOnce(new OperationsApiError(412,'conflict'));mount();await userEvent.click(await screen.findByRole('button',{name:'Save'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Save'})).toBeDisabled();await userEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Save'})).not.toBeDisabled())})
