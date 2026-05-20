export const fmtCur = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export const todayStr = () => new Date().toISOString().slice(0, 10)

export const initials = (nome) =>
  (nome || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

export const monthStr = (d) => {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

export const currentMonth = () => {
  const n = new Date()
  return `${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`
}

export const compressImage = (file, maxW = 200, maxH = 200, quality = 0.75) =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
