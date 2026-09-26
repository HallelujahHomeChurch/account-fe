import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { useManagedMutation } from './organization-state'

it('blocks duplicate clicks and reuses the receipt key after an uncertain failure', async () => {
  const { result } = renderHook(useManagedMutation)
  let reject!: (reason: Error) => void
  const execute = vi.fn((_key: string) => new Promise((_, fail) => { reject = fail }))
  let first!: Promise<boolean>
  act(() => { first = result.current.mutate('admit:account', execute) })
  await act(async () => { expect(await result.current.mutate('admit:account', execute)).toBe(false) })
  expect(execute).toHaveBeenCalledTimes(1)
  await act(async () => { reject(new Error('response lost')); expect(await first).toBe(false) })
  expect(result.current.error).toBe('failed')
  const retry = vi.fn().mockResolvedValue(undefined)
  await act(async () => { expect(await result.current.mutate('admit:account', retry)).toBe(true) })
  expect(retry).toHaveBeenCalledWith(execute.mock.calls[0][0])
  await act(async () => { await result.current.mutate('admit:account', retry) })
  expect(retry.mock.calls[1][0]).not.toBe(retry.mock.calls[0][0])
})

it('does not continue navigation or form updates after its scope unmounts', async () => {
  const { result, unmount } = renderHook(useManagedMutation)
  let resolve!: () => void
  let mutation!: Promise<boolean>
  act(() => { mutation = result.current.mutate('move', () => new Promise<void>(done => { resolve = done })) })
  unmount()
  resolve()
  expect(await mutation).toBe(false)
})
