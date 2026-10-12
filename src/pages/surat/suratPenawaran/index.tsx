import { useEffect, useState } from 'react'
import {
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FileType,
  Plus,
  Trash2,
} from 'lucide-react'
import QuotationPreview from './QuotationPreview'
import {
  getIntroduction,
  loadTemplateModel,
  type TemplateModel,
} from './templateModel'
import {
  MAX_INTRODUCTION_LENGTH,
  MAX_ITEMS,
  MAX_ITEM_DESCRIPTION_LENGTH,
  calculateTotals,
  createEmptyItem,
  downloadBlob,
  getPrintedItems,
  quotationFileName,
  rupiahFormatter,
  validateQuotation,
  type ExportFormat,
  type QuotationData,
  type QuotationItem,
  type TaxMode,
} from './quotationShared'

type QuotationFormData = QuotationData & {
  signatureImage?: string
  stampImage?: string
}

const initialData: QuotationFormData = {
  recipient: '',
  address: '',
  city: '',
  date: new Date().toLocaleDateString('sv-SE'),
  number: '',
  validityDays: '30',

  senderCompany: 'PT Sinergi Karunia Sejahtera',
  introduction: '',

  signer: '',
  position: '',
  email: '',
  phone: '',

  taxEnabled: true,
  taxMode: 'manual',
  taxRate: 11,
  taxManualAmount: 0,

  items: [createEmptyItem()],
}
type Field = Exclude<keyof QuotationData, 'items'>
type ItemField = Exclude<keyof QuotationItem, 'id'>

const cellInput =
  'w-full rounded-lg border border-slate-300 px-8 py-8 font-normal focus:border-slate-600 focus:outline-none'

/**
 * Mengubah gambar PNG, JPG, atau WEBP menjadi data URL PNG.
 * Hasilnya bisa dipakai untuk pratinjau dan diteruskan ke fungsi ekspor.
 */
function readImageAsPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight

        const context = canvas.getContext('2d')

        if (!context) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Gambar tidak dapat diproses.'))
          return
        }

        context.drawImage(image, 0, 0)

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl)

            if (!blob) {
              reject(new Error('Gagal mengonversi gambar.'))
              return
            }

            const reader = new FileReader()

            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result)
              } else {
                reject(new Error('Gagal membaca gambar.'))
              }
            }

            reader.onerror = () => {
              reject(new Error('Gagal membaca gambar.'))
            }

            reader.readAsDataURL(blob)
          },
          'image/png',
        )
      } catch {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Gagal memproses gambar.'))
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('File gambar tidak dapat dibuka.'))
    }

    image.src = objectUrl
  })
}

export default function SuratPenawaran() {
  const [data, setData] = useState<QuotationFormData>(initialData)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<ExportFormat | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [model, setModel] = useState<TemplateModel | null>(null)
  
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [stampFile, setStampFile] = useState<File | null>(null)
  const [uploadMessage, setUploadMessage] = useState('')

  useEffect(() => {

 async function load(){

  try{
    const result =
      await loadTemplateModel()

    setModel(result)

  }catch{
    setModel(null)
  }

 }

 load()

},[])

  function change(field: Field, value: string) {
    setData((previous) => ({
      ...previous,
      [field]: value,
    }))
    setError('')
  }

  function changeItem(id: string, field: ItemField, value: string) {
    setData((previous) => ({
      ...previous,
      items: previous.items.map((item) => {
        if (item.id !== id) return item

        if (field === 'quantity' || field === 'unitPrice') {
          return {
            ...item,
            [field]: value === '' ? 0 : Number(value),
          }
        }

        return {
          ...item,
          [field]: value,
        }
      }),
    }))

    setError('')
  }

  function addItem() {
    setData((previous) =>
      previous.items.length >= MAX_ITEMS
        ? previous
        : {
            ...previous,
            items: [...previous.items, createEmptyItem()],
          },
    )

    setError('')
  }

  function removeItem(id: string) {
    setData((previous) => {
      const items = previous.items.filter((item) => item.id !== id)

      return {
        ...previous,
        items: items.length ? items : [createEmptyItem()],
      }
    })

    setError('')
  }

  async function uploadCompanyAsset(
    kind: 'signature' | 'stamp',
    file: File | null,
  ) {
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setUploadMessage('Gunakan file gambar PNG, JPG, atau WEBP.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', kind)

    try {
      const response = await fetch('http://localhost:3001/api/assets', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || 'Unggah file gagal.')
      }

      setUploadMessage(
        `${kind === 'signature' ? 'Tanda tangan' : 'Stempel perusahaan'} berhasil diunggah ke backend.`,
      )
    } catch (cause) {
      setUploadMessage(
        cause instanceof Error
          ? `${cause.message} Gambar lokal tetap dapat digunakan jika sudah berhasil diproses.`
          : 'Gagal mengunggah file. Pastikan backend berjalan.',
      )
    }
  }

  async function handleSignatureChange(
  file: File | null,
) {

  setUploadMessage('')


  if (!file) {

    setSignatureFile(null)

    setData((previous) => ({
      ...previous,
      signatureImage: undefined,
    }))

    return

  }


  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
  ]


  if (!allowedTypes.includes(file.type)) {

    setSignatureFile(null)

    setUploadMessage(
      'Gunakan file gambar PNG, JPG, atau WEBP.',
    )

    return

  }


  if(file.size > 5 * 1024 * 1024){

    setSignatureFile(null)

    setUploadMessage(
      'Ukuran gambar maksimal 5MB.',
    )

    return

  }



  try {


    const signatureImage =
      await readImageAsPng(file)



    setSignatureFile(file)


    setData((previous)=>({
      ...previous,
      signatureImage,
    }))



    await uploadCompanyAsset(
      'signature',
      file,
    )


    setUploadMessage(
      'Gambar tanda tangan siap digunakan.',
    )


  }
  catch(cause){

    setUploadMessage(
      cause instanceof Error
      ? cause.message
      : 'Gagal memproses gambar tanda tangan.',
    )

  }


}





async function handleStampChange(
  file: File | null,
) {

  setUploadMessage('')


  if (!file) {


    setStampFile(null)


    setData((previous)=>({
      ...previous,
      stampImage:undefined,
    }))


    return

  }



  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
  ]



  if(!allowedTypes.includes(file.type)){


    setStampFile(null)


    setUploadMessage(
      'Gunakan file gambar PNG, JPG, atau WEBP.',
    )


    return

  }



  if(file.size > 5 * 1024 * 1024){


    setStampFile(null)


    setUploadMessage(
      'Ukuran gambar maksimal 5MB.',
    )


    return

  }





  try{


    const stampImage =
      await readImageAsPng(file)



    setStampFile(file)



    setData((previous)=>({

      ...previous,

      stampImage,

    }))





    await uploadCompanyAsset(
      'stamp',
      file,
    )



    setUploadMessage(
      'Gambar stempel siap digunakan.',
    )



  }
  catch(cause){


    setUploadMessage(

      cause instanceof Error

      ? cause.message

      : 'Gagal memproses gambar stempel.',

    )


  }



}


async function download(format: ExportFormat) {
  const problem = validateQuotation(data)

  if (problem) {
    setError(problem)
    return
  }

  setDownloading(format)
  setError('')

  try {
    let file: Blob

    if (format === 'pdf') {
      const { createQuotationPdf } = await import('./exportPdf')

      file = await createQuotationPdf(data)

    } else if (format === 'docx') {

      const { createQuotationWord } = await import('./exportWord')

      file = await createQuotationWord(data)

    } else {

      const { createQuotationExcel } = await import('./exportExcel')

      file = await createQuotationExcel(data)

    }


    downloadBlob(
      file,
      quotationFileName(data, format),
    )


  } catch (cause) {

    setError(
      cause instanceof Error
        ? cause.message
        : 'Gagal membuat file.',
    )

  } finally {

    setDownloading(null)

  }
}
  const { subtotal, tax, grandTotal } = calculateTotals(
  getPrintedItems(data),
  data,
)

  return (
    <div className="scrollbar h-full w-full overflow-auto pb-32">
      <div className="mx-auto flex max-w-[190rem] flex-col gap-24">
        <div>
          <h1 className="text-[3rem] font-bold">Surat Penawaran</h1>
          <p className="text-slate-600">
            Isi data dan tabel produk, periksa pratinjau, lalu unduh surat
            sebagai Excel, PDF, atau Word.
          </p>
        </div>

        <div className="grid items-start gap-24 desktop:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-24">
            {/* Data penerima dan penawaran */}
            <div className="grid gap-24 rounded-2xl border bg-white p-24 shadow-sm md:grid-cols-2">
              <section className="flex flex-col gap-12">
                <h2 className="text-[2.2rem] font-semibold">Penerima</h2>

                <FieldInput
                  label="Nama atau perusahaan tujuan *"
                  value={data.recipient}
                  onChange={(value) => change('recipient', value)}
                />

                <FieldInput
                  label="Alamat tujuan"
                  value={data.address}
                  onChange={(value) => change('address', value)}
                />

                <FieldInput
                  label="Kota dan kode pos"
                  value={data.city}
                  onChange={(value) => change('city', value)}
                />
              </section>

              <section className="flex flex-col gap-12">
                <h2 className="text-[2.2rem] font-semibold">Penawaran</h2>

                <FieldInput
                  label="Tanggal *"
                  type="date"
                  value={data.date}
                  onChange={(value) => change('date', value)}
                />

                <FieldInput
                  label="Nomor penawaran *"
                  value={data.number}
                  onChange={(value) => change('number', value)}
                />

                <FieldInput
                  label="Masa berlaku (hari)"
                  type="number"
                  value={data.validityDays}
                  onChange={(value) => change('validityDays', value)}
                />
              </section>
            </div>

            {/* Deskripsi penawaran */}
            <section className="flex flex-col gap-12 rounded-2xl border bg-white p-24 shadow-sm">
              <div>
                <h2 className="text-[2.2rem] font-semibold">
                  Deskripsi penawaran
                </h2>

                <p className="text-slate-600">
                  Tulis paragraf pembuka surat. Tekan Enter untuk membuat
                  baris baru.
                </p>
              </div>

              <FieldTextArea
                label="Deskripsi / paragraf pembuka"
                value={data.introduction}
                placeholder={
                  model
                    ? getIntroduction(
                        { ...data, introduction: '' },
                        model,
                      )
                    : ''
                }
                maxLength={MAX_INTRODUCTION_LENGTH}
                rows={6}
                onChange={(value) => change('introduction', value)}
              />
            </section>

            {/* Tabel produk */}
            <section className="flex flex-col gap-16 rounded-2xl border bg-white p-24 shadow-sm">
              <div>
                <h2 className="text-[2.2rem] font-semibold">Tabel produk</h2>

                <p className="text-slate-600">
                  Masukkan maksimal 10 item. Deskripsi dapat diperbesar
                  dengan menarik sudut kanan bawah kolom.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[78rem] border-collapse text-left">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="w-48 p-8 text-center font-semibold">
                        No
                      </th>
                      <th className="p-8 font-semibold">Deskripsi</th>
                      <th className="w-80 p-8 font-semibold">Jumlah</th>
                      <th className="w-96 p-8 font-semibold">Satuan</th>
                      <th className="w-[18rem] p-8 font-semibold">
                        Harga satuan (Rp)
                      </th>
                      <th className="w-[14rem] p-8 text-right font-semibold">
                        Total (Rp)
                      </th>
                      <th className="w-48 p-8">
                        <span className="sr-only">Hapus</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.items.map((item, index) => (
                      <tr
                        className="border-t border-slate-200 align-top"
                        key={item.id}
                      >
                        <td className="p-8 pt-12 text-center">
                          {index + 1}
                        </td>

                        <td className="p-8">
                          <textarea
                            aria-label={`Deskripsi produk ${index + 1}`}
                            value={item.description}
                            rows={5}
                            maxLength={MAX_ITEM_DESCRIPTION_LENGTH}
                            placeholder="Nama produk / jasa beserta keterangannya"
                            onChange={(event) =>
                              changeItem(
                                item.id,
                                'description',
                                event.target.value,
                              )
                            }
                            className={cellInput + ' resize-y'}
                          />
                        </td>

                        <td className="p-8">
                          <input
                            aria-label={`Jumlah produk ${index + 1}`}
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) =>
                              changeItem(
                                item.id,
                                'quantity',
                                event.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>

                        <td className="p-8">
                          <input
                            aria-label={`Satuan produk ${index + 1}`}
                            value={item.unit}
                            onChange={(event) =>
                              changeItem(
                                item.id,
                                'unit',
                                event.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>

                        <td className="p-8">
                          <input
                            aria-label={`Harga satuan produk ${index + 1}`}
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(event) =>
                              changeItem(
                                item.id,
                                'unitPrice',
                                event.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>

                        <td className="p-8 pt-12 text-right">
                          {Math.round(
                            item.quantity * item.unitPrice,
                          ).toLocaleString('id-ID')}
                        </td>

                        <td className="p-8 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Hapus baris ${index + 1}`}
                            title="Hapus baris"
                            className="rounded-lg p-8 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-16">
                <button
                  type="button"
                  onClick={addItem}
                  disabled={data.items.length >= MAX_ITEMS}
                  className="flex items-center gap-8 rounded-xl border border-slate-400 px-16 py-8 hover:bg-slate-100 disabled:opacity-60"
                >
                  <Plus size={16} />
                  Tambah baris
                </button>

<div className="text-right">
  <p>Subtotal: {rupiahFormatter.format(subtotal)}</p>

  <div className="mt-12 flex flex-col items-end gap-8">
    <label className="flex items-center justify-end gap-8">
      <input
        type="checkbox"
        checked={data.taxEnabled !== false}
        onChange={(event) =>
          setData((previous) => ({
            ...previous,
            taxEnabled: event.target.checked,
          }))
        }
        className="h-16 w-16"
      />
      <span>Gunakan PPN</span>
    </label>

    {data.taxEnabled !== false && (
      <>
        <label className="flex items-center justify-end gap-8">
          <span>Metode PPN:</span>
          <select
            value={data.taxMode ?? 'manual'}
            onChange={(event) =>
              setData((previous) => ({
                ...previous,
                taxMode: event.target.value as TaxMode,
              }))
            }
            className="rounded-lg border border-slate-300 px-8 py-6"
          >
            <option value="manual">Nominal manual (Rp)</option>
            <option value="percent">Persentase (%)</option>
          </select>
        </label>

        {data.taxMode === 'percent' ? (
          <label className="flex items-center justify-end gap-8">
            <span>Persentase PPN (%):</span>
            <input
              aria-label="Persentase PPN"
              type="number"
              min="0"
              step="0.01"
              value={data.taxRate ?? 11}
              onChange={(event) =>
                setData((previous) => ({
                  ...previous,
                  taxRate:
                    event.target.value === ''
                      ? 0
                      : Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className="w-56 rounded-lg border border-slate-300 px-8 py-6 text-right"
            />
          </label>
        ) : (
          <label className="flex items-center justify-end gap-8">
            <span>Nominal PPN (Rp):</span>
            <input
              aria-label="Nominal PPN dalam rupiah"
              type="number"
              min="0"
              step="1"
              value={data.taxManualAmount ?? 0}
              onChange={(event) =>
                setData((previous) => ({
                  ...previous,
                  taxManualAmount:
                    event.target.value === ''
                      ? 0
                      : Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className="w-56 rounded-lg border border-slate-300 px-8 py-6 text-right"
            />
          </label>
        )}
      </>
    )}
  </div>

  <p className="mt-8">
    PPN: {rupiahFormatter.format(tax)}
  </p>

  <p className="font-bold">
    Grand total: {rupiahFormatter.format(grandTotal)}
  </p>
</div>
              </div>
            </section>

            {/* Pengirim, tanda tangan, dan stempel */}
            <section className="grid gap-12 rounded-2xl border bg-white p-24 shadow-sm md:grid-cols-2">
              <h2 className="md:col-span-2 text-[2.2rem] font-semibold">
                Pengirim dan penandatangan
              </h2>

              <FieldInput
                label="Nama perusahaan pengirim *"
                value={data.senderCompany}
                onChange={(value) => change('senderCompany', value)}
              />

              <FieldInput
                label="Nama penandatangan"
                value={data.signer}
                onChange={(value) => change('signer', value)}
              />

              <FieldInput
                label="Jabatan"
                value={data.position}
                onChange={(value) => change('position', value)}
              />

              <FieldInput
                label="Email (opsional)"
                type="email"
                value={data.email}
                onChange={(value) => change('email', value)}
              />

              <FieldInput
                label="Nomor kontak (opsional)"
                type="tel"
                value={data.phone}
                onChange={(value) => change('phone', value)}
              />

              {/* Input tanda tangan */}
              <div className="flex flex-col gap-4">
                <label className="flex min-w-0 flex-col gap-4 font-medium">
                  <span>Template tanda tangan (PNG/JPG/WEBP)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      void handleSignatureChange(
                        event.target.files?.[0] ?? null,
                      )
                    }}
                    className="w-full rounded-lg border border-slate-300 px-12 py-8 font-normal"
                  />
                </label>

                {signatureFile && (
                  <span className="text-sm text-slate-600">
                    Dipilih: {signatureFile.name}
                  </span>
                )}

                {data.signatureImage && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-12">
                    <p className="mb-8 text-sm font-medium">
                      Pratinjau tanda tangan
                    </p>
                    <img
                      src={data.signatureImage}
                      alt="Pratinjau tanda tangan"
                      className="max-h-32 max-w-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Input stempel */}
              <div className="flex flex-col gap-4">
                <label className="flex min-w-0 flex-col gap-4 font-medium">
                  <span>Template stempel perusahaan (PNG/JPG/WEBP)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      void handleStampChange(
                        event.target.files?.[0] ?? null,
                      )
                    }}
                    className="w-full rounded-lg border border-slate-300 px-12 py-8 font-normal"
                  />
                </label>

                {stampFile && (
                  <span className="text-sm text-slate-600">
                    Dipilih: {stampFile.name}
                  </span>
                )}

                {data.stampImage && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-12">
                    <p className="mb-8 text-sm font-medium">
                      Pratinjau stempel
                    </p>
                    <img
                      src={data.stampImage}
                      alt="Pratinjau stempel perusahaan"
                      className="max-h-32 max-w-full object-contain"
                    />
                  </div>
                )}
              </div>

              {uploadMessage && (
                <p
                  role="status"
                  className="md:col-span-2 text-slate-600"
                >
                  {uploadMessage}
                </p>
              )}
            </section>

            <p className="text-slate-600">
              Email dan nomor kontak bersifat opsional.
            </p>
          </div>

          {/* Pratinjau surat dan tombol ekspor */}
          <aside className="flex min-w-0 flex-col gap-12 rounded-2xl border bg-white p-24 shadow-sm desktop:sticky desktop:top-0">
            <div className="flex flex-wrap items-center justify-between gap-12">
              <h2 className="text-[2.2rem] font-semibold">
                Pratinjau surat
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowPreview((previous) => !previous)
                }
                aria-pressed={showPreview}
                className="flex items-center gap-8 rounded-xl border border-slate-400 px-16 py-8 hover:bg-slate-100"
              >
                {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPreview ? 'Sembunyikan' : 'Tampilkan pratinjau'}
              </button>
            </div>

            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-8">
              <ExportButton
                icon={<FileSpreadsheet size={16} />}
                label="Unduh Excel (.xlsx)"
                busyLabel="Menyiapkan Excel..."
                busy={downloading === 'xlsx'}
                disabled={downloading !== null}
                onClick={() => download('xlsx')}
              />

              <ExportButton
                icon={<FileText size={16} />}
                label="Unduh PDF (.pdf)"
                busyLabel="Menyiapkan PDF..."
                busy={downloading === 'pdf'}
                disabled={downloading !== null}
                onClick={() => download('pdf')}
              />

              <ExportButton
                icon={<FileType size={16} />}
                label="Unduh Word (.docx)"
                busyLabel="Menyiapkan Word..."
                busy={downloading === 'docx'}
                disabled={downloading !== null}
                onClick={() => download('docx')}
              />
            </div>

            {showPreview && <QuotationPreview data={data} />}
          </aside>
        </div>
      </div>
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-4 font-medium">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={type === 'number' ? '0' : undefined}
        className="w-full rounded-lg border border-slate-300 px-12 py-8 font-normal focus:border-slate-600 focus:outline-none"
      />
    </label>
  )
}

function FieldTextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength: number
  rows?: number
}) {
  return (
    <label className="flex min-w-0 flex-col gap-4 font-medium">
      <span>{label}</span>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-slate-300 px-12 py-8 font-normal focus:border-slate-600 focus:outline-none"
      />
      <span className="self-end text-[1.4rem] font-normal text-slate-500">
        {value.length}/{maxLength}
      </span>
    </label>
  )
}

function ExportButton({
  icon,
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
}: {
  icon?: JSX.Element
  label: string
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="
        flex
        items-center
        justify-center
        gap-8
        rounded-xl
        bg-slate-700
        px-16
        py-8
        text-white
        hover:bg-slate-800
        disabled:opacity-60
      "
    >
      {icon}

      {busy ? busyLabel : label}

    </button>
  )
}