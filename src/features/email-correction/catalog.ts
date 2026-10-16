export type CorrectionField = {
  key: 'currentEmail' | 'newEmail'
  type: 'email'
  labelKey: 'currentEmail' | 'newEmail'
  readOnly: boolean
  required: boolean
}

// This catalog describes this feature's fields, not a general workflow engine.
export const correctionCatalog = [{
  kind: 'email_change',
  labelKey: 'emailChange',
  fields: [
    { key: 'currentEmail', type: 'email', labelKey: 'currentEmail', readOnly: true, required: true },
    { key: 'newEmail', type: 'email', labelKey: 'newEmail', readOnly: false, required: true },
  ] satisfies CorrectionField[],
}] as const
