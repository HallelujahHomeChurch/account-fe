// Local synthetic shell data; no session client, storage, token, or HTTP transport.
const auth = {
  status: 'authenticated', isBootstrapping: false, accessToken: null,
  profile: { id: 'fixture-person', email: 'member@example.test', nickname: '陳恩典 Grace Chen', first_name: 'Grace', last_name: 'Chen', is_email_verified: true, permissions: [], avatar_url: '/assets/brand/account-placeholder.svg' },
  presentation: { capture: () => () => true },
  navigation: { sources: { account: { ids: ['shell'] } } },
  api: { getAuthCapabilities: async () => ({ providers: [], registrationEnabled: false, emailCorrectionEnabled: true, memberDetailsEnabled: false, policy: { enforced: false } }) },
  operationsApi: { listMyResources: async () => [], getMyAccess: async () => ({ churchMembership: null, responsibilities: [], memberDetailsEligible: false }) },
  logout: async () => undefined,
}
export function useAuth() { return auth }
