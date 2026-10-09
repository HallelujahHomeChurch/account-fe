import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { StatementStrip } from './StatementStrip'

const auth = vi.hoisted(() => ({status: 'anonymous', profile: {id: 'owner-a'}, accessToken: 'token', api: {refreshAccessToken: async () => null}}))
vi.mock('../auth/auth-context', () => ({useAuth: () => auth}))
vi.mock('../i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'zh-Hant', messages: { site: { statement: { notice: '教會聲明', readFull: '閱讀全文', close: '關閉', doNotShowAgain: '不再顯示', openImage: '放大圖片', closeImage: '關閉圖片', syncError: '無法同步不再顯示設定' } } } }),
}))

beforeEach(() => {
  auth.accessToken = 'token'
  auth.profile.id = 'owner-a'
  auth.status = 'anonymous'
  localStorage.clear()
  document.cookie = 'hhc_statement_dismissed=; Max-Age=0; Path=/'
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => vi.unstubAllGlobals())

it('links an active profile statement to the public website', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { id: '00000000-0000-4000-8000-000000000001', publishedVersion: 7, title: '正式聲明', body: '聲明內文', bodyJson: { schemaVersion: 1, blocks: [{ id: 'p', type: 'paragraph', content: [{ type: 'text', text: '聲明內文', marks: ['strong'] }] }, { id: 'photo', type: 'image', url: '/assets/statement/photo', alt: { mode: 'text', text: '聲明圖片' } }] }, resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/00000000-0000-4000-8000-000000000001', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-01T00:00:00Z' },
  } })))
  vi.stubGlobal('fetch', fetcher)

  render(<StatementStrip />)

  expect(await screen.findByRole('link', { name: /正式聲明.*閱讀全文/ })).toHaveAttribute('href', 'https://www.alive.org.tw/zh-Hant/statements/00000000-0000-4000-8000-000000000001')
  const dialog = await screen.findByRole('dialog', { name: '正式聲明' })
  expect(within(dialog).getByText('聲明內文').tagName).toBe('STRONG')
  fireEvent.click(within(dialog).getByRole('button', { name: '放大圖片: 聲明圖片' }))
  expect(screen.getByRole('dialog', { name: '放大圖片' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '關閉圖片' }))
  fireEvent.click(within(dialog).getByRole('checkbox', { name: '不再顯示' }))
  fireEvent.click(within(dialog).getAllByRole('button', { name: '關閉' })[0])
  expect(document.cookie).toContain('hhc_statement_dismissed=00000000-0000-4000-8000-000000000001.7')
  expect((fetcher.mock.calls[0][0] as Request).url).toContain('/api/statements/active?locale=zh-Hant')
})

it('honors the shared dismissal from the public website', async () => {
  document.cookie = 'hhc_statement_dismissed=00000000-0000-4000-8000-000000000001.7; Path=/'
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { id: '00000000-0000-4000-8000-000000000001', publishedVersion: 7, title: '正式聲明', body: '聲明內文', resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/00000000-0000-4000-8000-000000000001', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-01T00:00:00Z' },
  } }))))
  render(<StatementStrip />)
  await screen.findByRole('link')
  await act(async () => {})
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('stays dismissed after the day changes and reopens for a new version', async () => {
  let version = 7
  let serverNow = '2026-09-29T02:00:00Z'
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow, nextChangeAt: null,
    statement: { id: '00000000-0000-4000-8000-000000000002', publishedVersion: version, title: '正式聲明', body: '聲明內文', resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/00000000-0000-4000-8000-000000000002', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-02T00:00:00Z' },
  } }))))
  render(<StatementStrip />)
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox', { name: '不再顯示' }))
  fireEvent.click(within(dialog).getAllByRole('button', { name: '關閉' })[0])
  serverNow = '2026-09-29T16:00:00Z'
  fireEvent.focus(window)
  await act(async () => {})
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  version = 8
  fireEvent.focus(window)
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

it.each([
  ['unsafe destination', '//other.example/statement', '2026-10-01T00:00:00Z'],
  ['expired statement', '/zh-Hant/statements/00000000-0000-4000-8000-000000000001', '2026-09-29T02:00:00Z'],
])('hides an %s', async (_case, href, popupEndsAt) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { title: '正式聲明', href, popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt },
  } }))))

  render(<StatementStrip />)

  await act(async () => {})
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

let sequence = 100
function payload(id: string) {return {serverNow: "2026-09-29T02:00:00Z", nextChangeAt: null, statement: {id, publishedVersion: 7, title: "正式聲明", body: "內文", resolvedLocale: "zh-Hant", availableLocales: ["zh-Hant"], href: `/zh-Hant/statements/${id}`, popupStartsAt: "2026-09-28T00:00:00Z", popupEndsAt: "2026-10-02T00:00:00Z"}}}
function mount() {return render(<StatementStrip />)}

it('waits for authentication before deciding whether to prompt', async () => {
  auth.status = 'loading';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({data: payload(id)}));
  vi.stubGlobal('fetch', fetcher);
  const view = mount();
  await screen.findByRole('link');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetcher.mock.calls).toHaveLength(1);
  auth.status = 'anonymous';
  view.rerender(<StatementStrip />);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
it('uses the account preference rather than anonymous storage', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  localStorage.setItem(`hhc:statement:${id}:dismissed-version`, '7');
  const fetcher = vi.fn<typeof fetch>(async request => {
    const req = request as Request;
    return Response.json({data: req.url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:false} : payload(id)});
  });
  vi.stubGlobal('fetch', fetcher);
  mount();
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect((fetcher.mock.calls[1][0] as Request).headers.get('Authorization')).toBe('Bearer token');
});
it('keeps the strip but suppresses the popup when preference lookup fails', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => (request as Request).url.includes('/me/') ? Response.json({error:{code:'unavailable',message:'offline'}},{status:503}) : Response.json({data:payload(id)})));
  mount(); await screen.findByRole('link'); await act(async () => {});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('discards delayed preferences after switching accounts', async () => {
  auth.status = 'authenticated'; auth.profile.id = 'owner-a';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  let finish!: (response: Response) => void;
  let reads = 0;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => {
    if (!(request as Request).url.includes('/me/')) return Response.json({data:payload(id)});
    if (++reads === 1) return new Promise<Response>(resolve => {finish = resolve;});
    return Response.json({data:{statementId:id,publishedVersion:7,dismissed:true}});
  }));
  const view = mount(); await waitFor(() => expect(reads).toBe(1));
  auth.profile.id = 'owner-b'; view.rerender(<StatementStrip />);
  await waitFor(() => expect(reads).toBe(2));
  await act(async () => {finish(Response.json({data:{statementId:id,publishedVersion:7,dismissed:false}}));});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('closes ordinarily and reports failed account writes without saving locally', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const fetcher = vi.fn<typeof fetch>(async request => {
    const req = request as Request;
    if (req.method === 'PUT') return Response.json({error:{code:'unavailable',message:'offline'}},{status:503});
    return Response.json({data:req.url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:false} : payload(id)});
  });
  vi.stubGlobal('fetch', fetcher); mount(); await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveTextContent('無法同步');
  expect(localStorage.getItem(`hhc:statement:${id}:dismissed-version`)).toBeNull();
});
it('closes an open dialog when another device has dismissed the version', async () => {
  auth.status = 'authenticated'; let hidden = false;
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => Response.json({data:(request as Request).url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:hidden} : payload(id)})));
  mount(); await screen.findByRole('dialog'); hidden = true;
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('link')).toBeInTheDocument();
});

it('still closes after recreating the transport for the same account and version', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => Response.json({data:(request as Request).url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:false} : payload(id)})));
  const view = mount(); await screen.findByRole('dialog');
  auth.accessToken = 'refreshed';
  view.rerender(<StatementStrip />); await act(async () => {});
  fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('does not let an old version write clear a newer pending write', async () => {
  auth.status = 'authenticated'; let version = 7;
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const finishes: Array<(response: Response) => void> = [];
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => {
    const req = request as Request;
    if (req.method === 'PUT') return new Promise<Response>(resolve => finishes.push(resolve));
    return Response.json({data:req.url.includes('/me/') ? {statementId:id,publishedVersion:version,dismissed:false} : {...payload(id),statement:{...payload(id).statement,publishedVersion:version}}});
  }));
  mount(); await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  await waitFor(() => expect(finishes).toHaveLength(1));
  version = 8; fireEvent.focus(window);
  await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  await waitFor(() => expect(finishes).toHaveLength(2));
  await act(async () => {finishes[0](Response.json({data:{statementId:id,publishedVersion:7,dismissed:true}}));});
  expect(screen.getByRole('checkbox')).toBeDisabled();
  await act(async () => {finishes[1](Response.json({data:{statementId:id,publishedVersion:8,dismissed:true}}));});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem(`hhc:statement:${id}:dismissed-version`)).toBeNull();
});
