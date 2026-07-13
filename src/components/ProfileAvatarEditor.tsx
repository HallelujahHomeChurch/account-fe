import { Button, Modal } from '@hhc/ui'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { createCroppedAvatarBlob, validateAvatarSource } from '../lib/avatar-crop'
import type { Profile } from '../lib/api'
import { AccountAvatar } from './AccountAvatar'

export function ProfileAvatarEditor({ profile }: { profile: Profile }) {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [isOpen, setOpen] = useState(false)
  const [imageSource, setImageSource] = useState('')
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setSaving] = useState(false)
  const objectURL = useRef('')

  useEffect(() => () => releaseObjectURL(objectURL), [])

  function resetSelection() {
    releaseObjectURL(objectURL)
    setImageSource('')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetSelection()
      setError('')
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!validateAvatarSource(file)) {
      setError(t.profile.avatarFileError)
      return
    }

    resetSelection()
    const source = URL.createObjectURL(file)
    objectURL.current = source
    setImageSource(source)
    setError('')
  }

  async function saveAvatar() {
    if (!auth.api.uploadAvatar || !imageSource || !croppedArea) return
    setSaving(true)
    setError('')
    try {
      const blob = await createCroppedAvatarBlob(imageSource, croppedArea)
      await auth.api.uploadAvatar(blob)
      await auth.refreshProfile()
      changeOpen(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  async function removeAvatar() {
    if (!auth.api.deleteAvatar) return
    setSaving(true)
    setError('')
    try {
      await auth.api.deleteAvatar()
      await auth.refreshProfile()
      changeOpen(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        aria-label={t.profile.changeAvatar}
        className="profile-avatar-trigger"
        onClick={() => setOpen(true)}
        title={t.profile.changeAvatar}
        type="button"
      >
        <AccountAvatar className="profile-avatar" profile={profile} size="lg" />
        <span className="profile-avatar-camera" aria-hidden="true">
          <Camera size={15} />
        </span>
      </button>

      <Modal isOpen={isOpen} onOpenChange={changeOpen}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container avatar-modal-container" placement="center">
            <Modal.Dialog className="modal-dialog avatar-modal-dialog">
              <Modal.Header>
                <Modal.Heading>{t.profile.profilePicture}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="avatar-modal-body">
                {imageSource ? (
                  <>
                    <div className="avatar-cropper">
                      <Cropper
                        aspect={1}
                        crop={crop}
                        cropShape="round"
                        image={imageSource}
                        maxZoom={3}
                        minZoom={1}
                        onCropChange={setCrop}
                        onCropComplete={(_, pixels) => setCroppedArea(pixels)}
                        onZoomChange={setZoom}
                        showGrid={false}
                        zoom={zoom}
                      />
                    </div>
                    <label className="avatar-zoom-control">
                      <span>{t.profile.zoom}</span>
                      <input
                        aria-label={t.profile.zoom}
                        max="3"
                        min="1"
                        onChange={(event) => setZoom(Number(event.target.value))}
                        step="0.01"
                        type="range"
                        value={zoom}
                      />
                    </label>
                  </>
                ) : (
                  <div className="avatar-current-preview">
                    <AccountAvatar className="avatar-current-image" profile={profile} size="lg" />
                    <p>{t.profile.avatarHelp}</p>
                  </div>
                )}

                <label className="avatar-file-button">
                  <ImagePlus size={16} aria-hidden="true" />
                  {t.profile.choosePhoto}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={t.profile.choosePhoto}
                    className="sr-only"
                    onChange={chooseFile}
                    type="file"
                  />
                </label>
                {error ? <p className="form-error">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer className="modal-actions avatar-modal-actions">
                {profile.avatar_url ? (
                  <Button isDisabled={isSaving} variant="ghost" onPress={removeAvatar}>
                    <Trash2 size={16} aria-hidden="true" />
                    {t.profile.removePhoto}
                  </Button>
                ) : null}
                <span className="avatar-modal-action-spacer" />
                <Button isDisabled={isSaving} variant="ghost" onPress={() => changeOpen(false)}>
                  {t.profile.cancel}
                </Button>
                {imageSource ? (
                  <Button isDisabled={isSaving || !croppedArea} onPress={saveAvatar}>
                    {t.profile.savePhoto}
                  </Button>
                ) : null}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
}

function releaseObjectURL(reference: { current: string }) {
  if (!reference.current) return
  URL.revokeObjectURL(reference.current)
  reference.current = ''
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : 'Request failed.'
}
