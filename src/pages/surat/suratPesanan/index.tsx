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

export default function SuratPesanan() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    logo: '',
    header1: 'PT SINAR ABADI SENTOSA',
    header2: 'DIVISI PENGADAAN & KONTRAK',
    header3: 'Ruko Artha Gading Niaga Blok D-10, Jakarta Utara | Telp: (021) 458-9999',
    nomor_surat: 'PO/2026/09/0088',
    perihal: 'Surat Pesanan Barang (Purchase Order)',
    ref_penawaran: 'SP/992/ABC/IX/2026',
    tempat_tanggal: `Jakarta, ${dayjs().locale('id').format('DD MMMM YYYY')}`,
    vendor_nama: 'Bapak Chandra Wijaya',
    vendor_perusahaan: 'PT Teknologi Mandiri Solusindo',
    vendor_alamat: 'Jl. Gatot Subroto No. 45, Jakarta Selatan',
    vendor_kontak: '0812-3456-7890',
    pembuka:
      'Dengan hormat,\nMenindaklanjuti surat penawaran harga yang telah disepakati sebelumnya, bersama ini kami sampaikan pesanan resmi (Purchase Order) untuk barang-barang berikut:',
    items: [
      { nama: 'Laptop Lenovo ThinkPad T14 Gen 4', jumlah: 5, satuan: 'Unit', harga: 16500000 },
      { nama: 'Monitor Dell 24 Inch IPS FHD', jumlah: 5, satuan: 'Unit', harga: 2200000 },
      { nama: 'Mouse Wireless Logitech M331', jumlah: 5, satuan: 'Pcs', harga: 185000 },
    ],
    kenaPpn: true,
    alamat_kirim: 'Gedung Sinar Abadi Lt. 2, Jl. Thamrin No. 10, Jakarta Pusat (Attn: Ibu Ratna)',
    tgl_kirim: 'Maksimal 7 hari kerja setelah PO diterbitkan',
    syarat_bayar: 'Transfer Bank BCA (Rek: 123-456-789 a.n PT Teknologi Mandiri) TOP 30 hari',
    penutup:
      'Demikian surat pesanan ini kami sampaikan. Mohon konfirmasi penerimaan pesanan dan estimasi pengiriman barang. Atas kerjasamanya kami ucapkan terima kasih.',
    pemesan_perusahaan: 'PT Sinar Abadi Sentosa',
    pemesan_nama: 'Bambang Trihatmodjo, S.E.',
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
      items: [...formData.items, { nama: '', jumlah: 1, satuan: 'Pcs', harga: 0 }],
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
    pdfMake.createPdf(generatePdfDefinition(formData) as any).download('surat-pesanan.pdf')
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
          <h1 className="text-[2.8rem] font-bold">Surat Pesanan (PO)</h1>
          <DocumentActions onOpen={handleOpen} onPrint={handlePrint} onDownload={handleDownload} />
        </div>

        <div className="flex flex-col gap-20 rounded-2xl border bg-white p-24 shadow-sm">
          <h2 className="text-[2rem] font-semibold text-slate-800">Kop Surat / Identitas Pemesan</h2>
          <label className="flex flex-col gap-4 text-slate-600">
            <span>Upload Logo Perusahaan:</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="rounded-lg border p-8" />
          </label>
          <FormInput name="header1" value={formData.header1} onChange={handleChange} placeholder="Nama Perusahaan Pemesan" />
          <FormInput name="header2" value={formData.header2} onChange={handleChange} placeholder="Sub Header / Divisi" />
          <FormInput name="header3" value={formData.header3} onChange={handleChange} placeholder="Alamat & Kontak Pemesan" />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Informasi Surat Pesanan</h2>
          <div className="grid grid-cols-2 gap-12">
            <FormInput name="nomor_surat" value={formData.nomor_surat} onChange={handleChange} placeholder="Nomor PO" />
            <FormInput name="tempat_tanggal" value={formData.tempat_tanggal} onChange={handleChange} placeholder="Tempat, Tanggal" />
            <FormInput name="ref_penawaran" value={formData.ref_penawaran} onChange={handleChange} placeholder="Referensi No. Penawaran" />
            <FormInput name="perihal" value={formData.perihal} onChange={handleChange} placeholder="Perihal" />
          </div>

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Penerima Pesanan (Vendor/Supplier)</h2>
          <FormInput name="vendor_nama" value={formData.vendor_nama} onChange={handleChange} placeholder="Nama Kontak Rekanan" />
          <FormInput name="vendor_perusahaan" value={formData.vendor_perusahaan} onChange={handleChange} placeholder="Nama Perusahaan Rekanan" />
          <FormInput name="vendor_alamat" value={formData.vendor_alamat} onChange={handleChange} placeholder="Alamat Rekanan" />
          <FormInput name="vendor_kontak" value={formData.vendor_kontak} onChange={handleChange} placeholder="No. Telepon Rekanan" />
          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Isi Pesanan</h2>
          <FormTextArea name="pembuka" value={formData.pembuka} onChange={handleChange} placeholder="Kalimat Pembuka" rows={3} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Daftar Barang yang Dipesan</h2>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-8 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.kenaPpn}
                onChange={(e) => setFormData({ ...formData, kenaPpn: e.target.checked })}
                className="h-6 w-6"
              />
              <span className="font-medium text-slate-700">Kenakan PPN 11%</span>
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-6 rounded-lg bg-slate-700 px-12 py-6 text-white text-[1.4rem] hover:bg-slate-800"
            >
              <Plus size={14} /> Tambah Item
            </button>
          </div>

          {formData.items.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-8 rounded-xl bg-slate-50 p-12 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[1.4rem] font-semibold text-slate-600">Item #{idx + 1}</span>
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
                    placeholder="Nama Barang & Spesifikasi"
                  />
                </div>
                <div>
                  <FormInput
                    name={`item_jumlah_${idx}`}
                    type="number"
                    value={item.jumlah}
                    onChange={(e) => handleItemChange(idx, 'jumlah', Number(e.target.value))}
                    placeholder="Qty"
                  />
                </div>
                <div>
                  <FormInput
                    name={`item_satuan_${idx}`}
                    value={item.satuan}
                    onChange={(e) => handleItemChange(idx, 'satuan', e.target.value)}
                    placeholder="Satuan (Pcs/Unit)"
                  />
                </div>
                <div className="col-span-4">
                  <FormInput
                    name={`item_harga_${idx}`}
                    type="number"
                    value={item.harga}
                    onChange={(e) => handleItemChange(idx, 'harga', Number(e.target.value))}
                    placeholder="Harga Satuan (Rp)"
                  />
                </div>
              </div>
            </div>
          ))}

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Ketentuan Pengiriman & Pembayaran</h2>
          <FormInput name="alamat_kirim" value={formData.alamat_kirim} onChange={handleChange} placeholder="Alamat Pengiriman" />
          <FormInput name="tgl_kirim" value={formData.tgl_kirim} onChange={handleChange} placeholder="Jadwal / Batas Pengiriman" />
          <FormInput name="syarat_bayar" value={formData.syarat_bayar} onChange={handleChange} placeholder="Syarat Pembayaran" />

          <FormTextArea name="penutup" value={formData.penutup} onChange={handleChange} placeholder="Kalimat Penutup" rows={3} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Penandatangan Pemesan</h2>
          <div className="grid grid-cols-2 gap-12">
            <FormInput name="pemesan_perusahaan" value={formData.pemesan_perusahaan} onChange={handleChange} placeholder="Nama Perusahaan" />
            <FormInput name="pemesan_nama" value={formData.pemesan_nama} onChange={handleChange} placeholder="Nama Penandatangan" />
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
