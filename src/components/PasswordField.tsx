import { FieldError, IconButton, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useLocale } from '../i18n/locale-context'

type PasswordFieldProps = {
  label: string
  name: string
  autoComplete: 'current-password' | 'new-password'
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  error?: string
}

export function PasswordField({ label, name, autoComplete, value, onChange, onBlur, error }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const { messages: t } = useLocale()
  return (
    <TextField isRequired name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange}
      onBlur={onBlur} isInvalid={Boolean(error)}>
      <Label>{label}</Label>
      <div className="password-field-control">
        <Input autoComplete={autoComplete} />
        <IconButton type="button" variant="ghost"
          aria-label={`${visible ? t.passwordVisibility.hide : t.passwordVisibility.show}: ${label}`}
          icon={visible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
          onPress={() => setVisible(current => !current)} />
      </div>
      <FieldError>{error}</FieldError>
    </TextField>
  )
}
