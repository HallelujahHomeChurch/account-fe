import type { Area } from 'react-easy-crop'

export const maxAvatarSourceBytes = 10 * 1024 * 1024
export const avatarSourceTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

export function validateAvatarSource(file: File) {
  return file.size > 0 && file.size <= maxAvatarSourceBytes && (avatarSourceTypes as readonly string[]).includes(file.type)
}

export async function createCroppedAvatarBlob(imageSource: string, crop: Area) {
  const image = await loadImage(imageSource)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image editor is not available in this browser.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 512, 512)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the profile picture.'))),
      'image/jpeg',
      0.9,
    )
  })
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read the selected image.'))
    image.src = source
  })
}
