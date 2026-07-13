import { Card } from '@hhc/ui'

export function OAuthCallbackPage() {
  return (
    <Card className="panel-card">
      <Card.Header>
        <Card.Title>OAuth callback</Card.Title>
        <Card.Description>This route is reserved for account-aware clients that return here.</Card.Description>
      </Card.Header>
    </Card>
  )
}
