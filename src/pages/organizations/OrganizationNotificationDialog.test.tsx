import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OrganizationNotificationDialog } from './OrganizationNotificationDialog'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

const api = { list: vi.fn(), preview: vi.fn(), submit: vi.fn() }
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue({ items: [], page: 1, perPage: 20, total: 0 }); api.preview.mockResolvedValue({ audienceAccounts: 2, emailRecipients: 1, webPushDevices: 3 }); vi.mocked(useAuth).mockReturnValue({ unitNotificationsApi: api } as never) })

it('forces one paired send after audience confirmation', async () => {
  api.submit.mockResolvedValue({ id: 'n1', orgUnitId: 'unit', subject: '主旨', body: '第一行\n第二行', audienceAccountCount: 2, createdAt: '2026-09-25T00:00:00Z', channels: [{ campaignId: 'e', channel: 'email', status: 'scheduled', recipientCount: 1 }, { campaignId: 'p', channel: 'web_push', status: 'scheduled', recipientCount: 3 }] })
  render(<OrganizationNotificationDialog isOpen unitId="unit" onOpenChange={vi.fn()} />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), '主旨')
  await userEvent.type(screen.getByRole('textbox', { name: 'Body' }), '第一行{enter}第二行')
  await userEvent.click(screen.getByRole('button', { name: 'Preview audience' }))
  expect(await screen.findByText('3')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(api.submit).toHaveBeenCalledWith('unit', '主旨', '第一行\n第二行', expect.any(String))
})
