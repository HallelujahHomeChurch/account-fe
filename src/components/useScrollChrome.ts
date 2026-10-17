import { useEffect, useEffectEvent, useState } from 'react'

export function useScrollChrome({ blocked, resetKey }: { blocked: boolean; resetKey: string }) {
  const [state, setState] = useState({ key: resetKey, visible: true })
  const isBlocked = useEffectEvent(() => blocked)
  useEffect(() => {
    let previous = Math.max(0, window.scrollY), direction = 0, distance = 0, frame = 0
    const scroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        const current = Math.max(0, window.scrollY), delta = current - previous, next = Math.sign(delta)
        previous = current
        if (isBlocked()) { direction = 0; distance = 0; frame = 0; return }
        if (next && next !== direction) { direction = next; distance = 0 }
        distance += Math.abs(delta)
        if (current <= 16 || distance >= 16) {
          setState({ key: resetKey, visible: current <= 16 || direction < 0 })
          distance = 0
        }
        frame = 0
      })
    }
    window.addEventListener('scroll', scroll, { passive: true })
    return () => { window.removeEventListener('scroll', scroll); cancelAnimationFrame(frame) }
  }, [resetKey])
  return { visible: blocked || state.key !== resetKey || state.visible }
}
