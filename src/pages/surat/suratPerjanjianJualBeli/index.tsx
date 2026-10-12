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

pdfMake.vfs = pdfFonts.vfs

export default function SuratPerjanjianJualBeli() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    title: 'SURAT PERJANJIAN JUAL BELI',
    nomor_surat: '015/SPJB/IX/2026',
    hari: 'Senin',
    tanggal: `${dayjs().locale('id').format('DD MMMM YYYY')}`,
    tempat: 'Jakarta Pusat',

    // Pihak Pertama (Penjual)
    penjual_nama: 'Agus Setiawan, S.Kom.',
    penjual_nik: '3171020304850001',
    penjual_pekerjaan: 'Wiraswasta',
    penjual_alamat: 'Jl. Merpati No. 12, RT 003/RW 005, Jakarta Pusat',
    penjual_telepon: '0812-9876-5432',

    // Pihak Kedua (Pembeli)
    pembeli_nama: 'Budi Santoso',
    pembeli_nik: '3174091208920003',
    pembeli_pekerjaan: 'Karyawan Swasta',
    pembeli_alamat: 'Jl. Melati Raya No. 45, Tebet, Jakarta Selatan',
    pembeli_telepon: '0857-1122-3344',

    // Pasal-pasal
    pasal1_objek:
      '1 (satu) unit Mobil Honda Civic 1.5 RS Turbo Sedan AT Tahun 2022, Warna Hitam Metalik, No. Polisi B 1234 XYZ, No. Rangka: MHRFC12345678, No. Mesin: L15BG98765.',
    pasal1_spesifikasi:
      'Kondisi barang bekas terawat, mesin beroperasi normal, surat-surat lengkap (BPKB, STNK asli atas nama Pihak Pertama, Faktur Pembelian).',
    pasal2_harga: 'Rp 425.000.000 (Empat Ratus Dua Puluh Lima Juta Rupiah)',
    pasal2_pembayaran:
      'Pelunasan secara transfer ke rekening BCA No. 8899-0011-22 a.n Agus Setiawan pada saat penandatanganan perjanjian ini.',
    pasal3_penyerahan:
      '1. Penyerahan unit mobil beserta kunci kontak, kunci cadangan, buku servis, STNK, dan BPKB asli dilakukan seketika setelah pembayaran dinyatakan berhasil diterima.\n2. Sejak tanggal serah terima, seluruh risiko, pajak tahunan berjalan, dan tanggung jawab hukum atas kendaraan beralih kepada PIHAK KEDUA.',
    pasal4_sengketa:
      'Apabila terjadi perselisihan terkait perjanjian ini, kedua belah pihak sepakat menyelesaikan secara musyawarah dan mufakat. Jika kata mufakat tidak tercapai, maka perselisihan akan diajukan ke Pengadilan Negeri Jakarta Pusat.',

    // Saksi-saksi
    saksi1_nama: 'Eko Purnomo',
    saksi2_nama: 'Dian Anggraeni',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
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
    pdfMake.createPdf(generatePdfDefinition(formData) as any).download('surat-perjanjian-jual-beli.pdf')
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
          <h1 className="text-[2.8rem] font-bold">Surat Perjanjian Jual Beli</h1>
          <DocumentActions onOpen={handleOpen} onPrint={handlePrint} onDownload={handleDownload} />
        </div>

        <div className="flex flex-col gap-20 rounded-2xl border bg-white p-24 shadow-sm">
          <h2 className="text-[2rem] font-semibold text-slate-800">Informasi Perjanjian</h2>
          <div className="grid grid-cols-2 gap-12">
            <FormInput name="nomor_surat" value={formData.nomor_surat} onChange={handleChange} placeholder="Nomor Surat" />
            <FormInput name="tempat" value={formData.tempat} onChange={handleChange} placeholder="Tempat Perjanjian" />
            <FormInput name="hari" value={formData.hari} onChange={handleChange} placeholder="Hari" />
            <FormInput name="tanggal" value={formData.tanggal} onChange={handleChange} placeholder="Tanggal" />
          </div>

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Pihak Pertama (Penjual)</h2>
          <FormInput name="penjual_nama" value={formData.penjual_nama} onChange={handleChange} placeholder="Nama Lengkap Penjual" />
          <FormInput name="penjual_nik" value={formData.penjual_nik} onChange={handleChange} placeholder="NIK / No. KTP" />
          <FormInput name="penjual_pekerjaan" value={formData.penjual_pekerjaan} onChange={handleChange} placeholder="Pekerjaan / Usaha" />
          <FormInput name="penjual_alamat" value={formData.penjual_alamat} onChange={handleChange} placeholder="Alamat Domisili" />
          <FormInput name="penjual_telepon" value={formData.penjual_telepon} onChange={handleChange} placeholder="Nomor Telepon / HP" />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Pihak Kedua (Pembeli)</h2>
          <FormInput name="pembeli_nama" value={formData.pembeli_nama} onChange={handleChange} placeholder="Nama Lengkap Pembeli" />
          <FormInput name="pembeli_nik" value={formData.pembeli_nik} onChange={handleChange} placeholder="NIK / No. KTP" />
          <FormInput name="pembeli_pekerjaan" value={formData.pembeli_pekerjaan} onChange={handleChange} placeholder="Pekerjaan" />
          <FormInput name="pembeli_alamat" value={formData.pembeli_alamat} onChange={handleChange} placeholder="Alamat Domisili" />
          <FormInput name="pembeli_telepon" value={formData.pembeli_telepon} onChange={handleChange} placeholder="Nomor Telepon / HP" />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Pasal 1: Objek Jual Beli</h2>
          <FormTextArea name="pasal1_objek" value={formData.pasal1_objek} onChange={handleChange} placeholder="Objek Barang yang Dijual" rows={3} />
          <FormTextArea name="pasal1_spesifikasi" value={formData.pasal1_spesifikasi} onChange={handleChange} placeholder="Kondisi & Kelengkapan" rows={2} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Pasal 2: Harga & Pembayaran</h2>
          <FormInput name="pasal2_harga" value={formData.pasal2_harga} onChange={handleChange} placeholder="Harga Kesepakatan" />
          <FormTextArea name="pasal2_pembayaran" value={formData.pasal2_pembayaran} onChange={handleChange} placeholder="Metode Pembayaran" rows={2} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Pasal 3: Penyerahan & Hak Milik</h2>
          <FormTextArea name="pasal3_penyerahan" value={formData.pasal3_penyerahan} onChange={handleChange} placeholder="Ketentuan Penyerahan" rows={3} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Pasal 4: Sengketa</h2>
          <FormTextArea name="pasal4_sengketa" value={formData.pasal4_sengketa} onChange={handleChange} placeholder="Ketentuan Sengketa" rows={3} />

          <h2 className="mt-8 text-[2rem] font-semibold text-slate-800">Saksi-Saksi</h2>
          <div className="grid grid-cols-2 gap-12">
            <FormInput name="saksi1_nama" value={formData.saksi1_nama} onChange={handleChange} placeholder="Nama Saksi I" />
            <FormInput name="saksi2_nama" value={formData.saksi2_nama} onChange={handleChange} placeholder="Nama Saksi II" />
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
