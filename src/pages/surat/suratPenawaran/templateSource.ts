import JSZip from 'jszip'

let templatePromise: Promise<ArrayBuffer> | null = null

/** Baca template Excel bawaan aplikasi (disimpan di public/templates), di-cache setelah dimuat. */
export function readTemplateBytes(): Promise<ArrayBuffer> {
  if (!templatePromise) {
    const templateUrl = `${import.meta.env.BASE_URL}templates/surat-penawaran.xlsx`
    templatePromise = fetch(templateUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('File template Excel bawaan tidak dapat diakses.')
        }
        return response.arrayBuffer()
      })
      .catch((error) => {
        templatePromise = null // izinkan mencoba lagi
        throw error
      })
  }
  return templatePromise
}

let logoPromise: Promise<Uint8Array | null> | null = null

/**
 * Ambil logo perusahaan dari template Excel (gambar PNG pertama di xl/media),
 * supaya PDF dan Word memakai logo yang sama dengan template.
 * Mengembalikan null bila logo tidak ada; dokumen tetap dibuat tanpa logo.
 */
export function loadTemplateLogo(): Promise<Uint8Array | null> {
  if (!logoPromise) {
    logoPromise = (async () => {
      try {
        const zip = await JSZip.loadAsync(await readTemplateBytes())
        const mediaName = Object.keys(zip.files).find((name) =>
          /^xl\/media\/[^/]+\.png$/i.test(name),
        )
        const entry = mediaName ? zip.file(mediaName) : null
        return entry ? await entry.async('uint8array') : null
      } catch {
        return null
      }
    })()
  }
  return logoPromise
}
