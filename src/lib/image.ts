export function resizeImageFile(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Falha ao carregar a imagem'))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png', 0.9))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
