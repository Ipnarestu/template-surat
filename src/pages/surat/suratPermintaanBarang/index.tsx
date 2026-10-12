import { useEffect, useState } from 'react'
import pdfMake from 'pdfmake/build/pdfmake'
import * as pdfFonts from 'pdfmake/build/vfs_fonts'
import DocumentActions from '@/components/common/documentAction'
import FormInput from '@/components/ui/formInput'
import FormTextArea from '@/components/ui/formTextArea'
import PDFPreview from '@/components/common/pdfPreview'
import { generatePdfDefinition } from './generatePDFDefenition'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import { Plus, Trash2 } from 'lucide-react'

pdfMake.vfs = pdfFonts.vfs

export default function SuratPermintaanBarang() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    logo: '',
    header1: 'PT MAJU SUKSES BERSAMA',
    header2: 'DIVISI OPERASIONAL & LOGISTIK',
    header3: 'Jl. Sudirman Kav. 21, Jakarta Pusat | Telp: (021) 555-1234 | Email: info@majusukses.com',
    nomor_surat: '042/SPB/MSB/IX/2026',
    lampiran: '-',
    perihal: 'Permintaan Pengadaan Barang Operasional',
    tempat_tanggal: `Jakarta, ${dayjs().locale('id').format('DD MMMM YYYY')}`,
    tujuan_nama: 'Bapak Hendra Gunawan',
    tujuan_jabatan: 'Kepala Bagian Pengadaan / Procurement',
    tujuan_perusahaan: 'PT Maju Sukses Bersama',
    tujuan_alamat: 'Gedung Wisma Niaga Lt. 4, Jakarta',
    pembuka:
      'Dengan hormat,\nSehubungan dengan menipisnya stok perlengkapan serta guna mendukung kelancaran operasional kerja di divisi kami, bersama ini kami bermaksud mengajukan permintaan barang dengan rincian sebagai berikut:',
    items: [
      { nama: 'Kertas HVS A4 80gr', jumlah: 10, satuan: 'Rim', keterangan: 'Kebutuhan dokumen operasional' },
      { nama: 'Toner Printer HP Laserjet', jumlah: 2, satuan: 'Pcs', keterangan: 'Untuk printer ruangan admin' },
      { nama: 'Ballpoint Pilot Hitam', jumlah: 5, satuan: 'Lusin', keterangan: 'Stok alat tulis kantor' },
    ],
    penutup:
      'Demikian surat permintaan barang ini kami sampaikan. Besar harapan kami permohonan ini dapat segera diproses. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.',
    mengetahui_jabatan: 'Mengetahui,\nHead of Department',
    mengetahui_nama: 'Ir. Ahmad Subarjo, M.M.',
    pemohon_jabatan: 'Pemohon,\nStaff Operasional',
    pemohon_nama: 'Dimas Wicaksono',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const updated = [...formData.items]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, items: updated })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { nama: '', jumlah: 1, satuan: 'Pcs', keterangan: '' }],
    })
  }

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        logo: reader.result as string,
      }))
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    const newTimer = setTimeout(() => {
      try {
        const docDef = generatePdfDefinition(formData)
        const pdfDoc = pdfMake.createPdf(docDef as any)
        pdfDoc.getBlob((blob) => {
          const url = URL.createObjectURL(blob)
          setPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return url
          })
        })
      } catch (err) {
        console.error('Error generating PDF:', err)
      }
    }, 600)
    setDebounceTimer(newTimer)
    return () => clearTimeout(newTimer)
  }, [formData])

  const handleDownload = () => {
    pdfMake.createPdf(generatePdfDefinition(formData) as any).download('surat-permintaan-barang.pdf')
  }

  const handlePrint = () => {
    pdfMake.createPdf(generatePdfDefinition(formData) as any).print()
  }

  const handleOpen = () => {
    pdfMake.createPdf(generatePdfDefinition(formData) as any).open()
  }

  return (
    <div className="scrollbar flex h-full w-full gap-32 overflow-auto phones:h-auto phones:flex-col phones:overflow-visible pb-32">
      {/* Kolom Form */}
      <div className="scrollbar flex h-full w-1/2 flex-col gap-24 overflow-auto phones:h-auto phones:w-full phones:overflow-visible">
        <div className="flex items-center justify-between">
          <h1 className="text-[2.8rem] font-bold">Surat Permintaan Barang</h1>
          <DocumentActions onOpen={handleOpen} onPrint={handlePrint} onDownload={handleDownload} />
        </div>

        <div className="flex flex-col gap-20 rounded-2xl border bg-white p-24 shadow-sm">
          <h2 className="text-[2rem] font-semibold text-slate-800">Kop Surat / Header</h2>
          <label className="flex flex-col gap-4 text-slate-600">
            <span>Upload Logo Perusahaan:</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="rounded-lg border p-8" />
          </label>
          <FormInput name="header1" value={formData.header1} onChange={handleChange} placeholder="Nama Perusahaan / Organisasi" />
          <FormInput name="header2" value={formData.header2} onChange={handleChange} placeholder="Sub Header / Divisi" />
          <FormInput name="header3" value={formData.header3} onChange={handleChange} placeholder="Alamat & Kontak" />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Informasi Surat</h2>
          <div className="grid grid-cols-2 gap-12">
            <FormInput name="nomor_surat" value={formData.nomor_surat} onChange={handleChange} placeholder="Nomor Surat" />
            <FormInput name="tempat_tanggal" value={formData.tempat_tanggal} onChange={handleChange} placeholder="Tempat, Tanggal" />
            <FormInput name="lampiran" value={formData.lampiran} onChange={handleChange} placeholder="Lampiran" />
            <FormInput name="perihal" value={formData.perihal} onChange={handleChange} placeholder="Perihal" />
          </div>

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Tujuan Permintaan</h2>
          <FormInput name="tujuan_nama" value={formData.tujuan_nama} onChange={handleChange} placeholder="Nama Penerima (Kepada Yth.)" />
          <FormInput name="tujuan_jabatan" value={formData.tujuan_jabatan} onChange={handleChange} placeholder="Jabatan" />
          <FormInput name="tujuan_perusahaan" value={formData.tujuan_perusahaan} onChange={handleChange} placeholder="Instansi / Perusahaan" />
          <FormInput name="tujuan_alamat" value={formData.tujuan_alamat} onChange={handleChange} placeholder="Alamat Tujuan" />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Isi Permintaan</h2>
          <FormTextArea name="pembuka" value={formData.pembuka} onChange={handleChange} placeholder="Kalimat Pembuka" rows={3} />

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Daftar Barang yang Diminta</span>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-6 rounded-lg bg-slate-700 px-12 py-6 text-white text-[1.4rem] hover:bg-slate-800"
            >
              <Plus size={14} /> Tambah Barang
            </button>
          </div>

          {formData.items.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-8 rounded-xl bg-slate-50 p-12 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[1.4rem] font-semibold text-slate-600">Barang #{idx + 1}</span>
                {formData.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-8">
                <div className="col-span-2">
                  <FormInput
                    name={`item_nama_${idx}`}
                    value={item.nama}
                    onChange={(e) => handleItemChange(idx, 'nama', e.target.value)}
                    placeholder="Nama Barang"
                  />
                </div>
                <div>
                  <FormInput
                    name={`item_jumlah_${idx}`}
                    type="number"
                    value={item.jumlah}
                    onChange={(e) => handleItemChange(idx, 'jumlah', Number(e.target.value))}
                    placeholder="Jumlah"
                  />
                </div>
                <div>
                  <FormInput
                    name={`item_satuan_${idx}`}
                    value={item.satuan}
                    onChange={(e) => handleItemChange(idx, 'satuan', e.target.value)}
                    placeholder="Satuan (Pcs/Rim)"
                  />
                </div>
                <div className="col-span-4">
                  <FormInput
                    name={`item_ket_${idx}`}
                    value={item.keterangan}
                    onChange={(e) => handleItemChange(idx, 'keterangan', e.target.value)}
                    placeholder="Keterangan / Keperluan"
                  />
                </div>
              </div>
            </div>
          ))}

          <FormTextArea name="penutup" value={formData.penutup} onChange={handleChange} placeholder="Kalimat Penutup" rows={3} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Tanda Tangan</h2>
          <div className="grid grid-cols-2 gap-12">
            <FormInput name="mengetahui_jabatan" value={formData.mengetahui_jabatan} onChange={handleChange} placeholder="Jabatan Mengetahui" />
            <FormInput name="pemohon_jabatan" value={formData.pemohon_jabatan} onChange={handleChange} placeholder="Jabatan Pemohon" />
            <FormInput name="mengetahui_nama" value={formData.mengetahui_nama} onChange={handleChange} placeholder="Nama Mengetahui" />
            <FormInput name="pemohon_nama" value={formData.pemohon_nama} onChange={handleChange} placeholder="Nama Pemohon" />
          </div>
        </div>
      </div>

      {/* Kolom Pratinjau PDF */}
      <div className="scrollbar flex h-full w-1/2 flex-col gap-16 overflow-auto phones:h-auto phones:w-full">
        <h2 className="text-[2.2rem] font-semibold text-slate-800">Pratinjau PDF</h2>
        <div className="h-[95rem] w-full rounded-2xl border bg-slate-100 p-8 shadow-inner">
          <PDFPreview pdfUrl={pdfUrl} />
        </div>
      </div>
    </div>
  )
}
