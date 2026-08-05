import { CircleAlert, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function AuthResultState({ children, tone = 'success' }: {
  children: ReactNode
  tone?: 'success' | 'danger'
}) {
  const Icon = tone === 'success' ? CheckCircle2 : CircleAlert

  return (
    <div className="auth-completion" role={tone === 'danger' ? 'alert' : 'status'}>
      <span className={`auth-result-mark auth-result-mark--${tone}`} aria-hidden="true">
        <Icon />
      </span>
      <p>{children}</p>
    </div>
  )
}
