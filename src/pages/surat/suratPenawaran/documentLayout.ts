import {
  calculateTotals,
  getPrintedItems,
  type QuotationData,
} from './quotationShared'
import {
  getIntroduction,
  validityText,
  type TemplateModel,
} from './templateModel'
import { countLines } from './textMetrics'

/**
 * "Cetak biru" surat: daftar baris persis seperti baris-baris di template Excel
 * (tinggi baris, lebar kolom, ukuran huruf). PDF, Word, dan pratinjau semuanya
 * digambar dari daftar yang sama, sehingga hasilnya selalu konsisten.
 */

/** Lebar kolom A-F template dalam poin (piksel Excel x 0,75). */
export const COLUMN_WIDTHS_PT: readonly number[] = Object.freeze([
  15, 195.75, 23.25, 33.75, 88.5, 100.5,
])
export const TABLE_WIDTH_PT = COLUMN_WIDTHS_PT.reduce(
  (sum, width) => sum + width,
  0,
)

/** Halaman A4 dan margin dari pengaturan halaman template (poin). */
export const PAGE = {
  width: 595.3,
  height: 841.9,
  left: 51.02,
  right: 51.02,
  top: 82.2,
  bottom: 53.86,
  header: 22.68,
  footer: 22.68,
  /** Tinggi baris 1 template (garis ganda di bawah kop). */
  titleRule: 3,
}

export type Align = 'left' | 'center' | 'right'

export type Content =
  | {
      type: 'text'
      text: string
      size: number
      bold?: boolean
      underline?: boolean
      align?: Align
    }
  /** Format akuntansi template: "Rp" di kiri, angka di kanan, nol tampil "-". */
  | { type: 'money'; value: number; size: number; bold?: boolean }

export type LayoutCell = { span: number; content?: Content }

export type LayoutRow = {
  /** Tinggi baris minimal (poin). */
  height: number
  cells: LayoutCell[]
  fill?: 'gray' | 'yellow'
  /** header: garis tipis atas & bawah. double: garis ganda di bawah baris. */
  border?: 'header' | 'double'
  vAlign?: 'top' | 'center' | 'bottom'
  /** Tinggi dikunci (isi yang lebih tinggi dipotong), seperti baris garis putus-putus. */
  exactHeight?: boolean
}

export const FILL_COLORS = { gray: 'D9D9D9', yellow: 'FFFF00' }

const text = (
  value: string,
  size: number,
  options: { bold?: boolean; underline?: boolean; align?: Align } = {},
): Content => ({ type: 'text', text: value, size, ...options })

const blank = (height: number): LayoutRow => ({ height, cells: [{ span: 6 }] })

/** Apakah deskripsi muat satu baris di kolom B (12 pt). */
const isSingleLine = (value: string) =>
  countLines(value, 12, COLUMN_WIDTHS_PT[1] - 4) === 1

export function buildLayoutRows(
  data: QuotationData,
  model: TemplateModel,
): LayoutRow[] {
const items = getPrintedItems(data)
const { subtotal, tax, grandTotal } = calculateTotals(items, data)
const rows: LayoutRow[] = []

  // Baris 2-5: penerima (kiri) dan Date / Qo Number / Validity (kanan)
  const meta = (label: string, value: string): LayoutCell[] => [
    { span: 1, content: text(label, 10) },
    { span: 1, content: text(value, 10) },
  ]
  rows.push({
    height: 16,
    cells: [
      { span: 4, content: text('Kepada Yth,', 12) },
      ...meta(model.labelDate, `: ${data.date}`),
    ],
  })
  rows.push({
    height: 15.5,
    cells: [
      { span: 4, content: text(data.recipient, 12, { bold: true }) },
      ...meta(model.labelNumber, `: ${data.number}`),
    ],
  })
  rows.push({
    height: 15.5,
    cells: [
      { span: 4, content: text(data.address, 12) },
      ...meta(model.labelValidity, validityText(data, model)),
    ],
  })
  rows.push({
    height: 15.5,
    cells: [{ span: 4, content: text(data.city, 12) }, { span: 2 }],
  })
  rows.push(blank(15.5), blank(15.5))

  // Baris 8-9: judul dan paragraf pembuka
  rows.push({
    height: 15.5,
    cells: [
      {
        span: 6,
        content: text(model.title, 12, {
          bold: true,
          underline: true,
          align: 'center',
        }),
      },
    ],
  })
  rows.push({
    height: 15.5,
    cells: [{ span: 6, content: text(getIntroduction(data, model), 12) }],
  })
  rows.push(blank(15.5))

  // Baris 11-12: judul kolom dan satu baris kosong di bawahnya
  rows.push({
    height: 15.5,
    border: 'header',
    vAlign: 'center',
    cells: model.columnHeaders.map((label) => ({
      span: 1,
      content: text(label, 12, { bold: true, align: 'center' }),
    })),
  })
  rows.push(blank(15.5))

  // Baris rincian produk (baris terakhir bergaris bawah ganda)
  if (items.length === 0)
    rows.push({ height: 16, border: 'double', cells: [{ span: 6 }] })
  items.forEach((item, index) => {
    const isLast = index === items.length - 1
    rows.push({
      height: isLast ? 16 : 15.5,
      border: isLast ? 'double' : undefined,
      vAlign: isSingleLine(item.description) ? 'center' : 'top',
      cells: [
        { span: 1, content: text(String(index + 1), 12, { align: 'right' }) },
        { span: 1, content: text(item.description, 12) },
        {
          span: 1,
          content: text(String(item.quantity), 12, { align: 'right' }),
        },
        { span: 1, content: text(item.unit, 12) },
        {
          span: 1,
          content: { type: 'money', value: item.unitPrice, size: 12 },
        },
        {
          span: 1,
          content: {
            type: 'money',
            value: item.quantity * item.unitPrice,
            size: 12,
          },
        },
      ],
    })
  })

  // Baris 15-17: Total, PPn, Grand Total (pita penuh selebar tabel)
  const total = (
    label: string,
    value: number,
    fill: 'gray' | 'yellow',
    height: number,
  ): LayoutRow => ({
    height,
    fill,
    cells: [
      { span: 4 },
      { span: 1, content: text(label, 12, { bold: true, align: 'right' }) },
      { span: 1, content: { type: 'money', value, size: 12, bold: true } },
    ],
  })
rows.push(total(model.labelTotal, subtotal, 'gray', 16))

// Jika PPN tidak aktif, baris PPN tetap ditampilkan dengan nilai nol.
rows.push(
  total(
    data.taxEnabled === false
      ? 'PPN (Nonaktif)'
      : data.taxMode === 'manual'
        ? 'PPN'
        : `PPN (${Number(data.taxRate ?? 11)}%)`,
    tax,
    'gray',
    15.5,
  ),
)

rows.push(total(model.labelGrandTotal, grandTotal, 'yellow', 15.5))
  rows.push(blank(15.5), blank(14.5))

  // Baris 20-24: syarat dan ketentuan (huruf 10 pt)
  rows.push({
    height: 14.5,
    cells: [{ span: 6, content: text(model.termsTitle, 10) }],
  })
  for (const term of model.termRows) {
    rows.push({
      height: 14.5,
      cells: [
        { span: 1, content: text(term.no, 10) },
        { span: 5, content: text(term.text, 10) },
      ],
    })
  }

  // Baris 25-29: kalimat penutup dan nama perusahaan
  rows.push(blank(15.5))
  rows.push({
    height: 15.5,
    cells: [{ span: 6, content: text(model.closing, 12) }],
  })
  rows.push(blank(15.5))
  rows.push({
    height: 15.5,
    cells: [{ span: 6, content: text(model.regards, 12) }],
  })
  rows.push({
    height: 15.5,
    cells: [{ span: 6, content: text(data.senderCompany, 12) }],
  })

  // Baris 30-40: ruang tanda tangan dan identitas penandatangan (huruf 11 pt)
  const small = (value: string, height = 14.5): LayoutRow => ({
    height,
    cells: [{ span: 6, content: text(value, 11) }],
  })
  rows.push(blank(14.5), blank(14.5))
  rows.push(
    small(model.signaturePlaceholders[0] ?? ''),
    small(model.signaturePlaceholders[1] ?? ''),
  )
  rows.push(blank(14.5), blank(14.5))
  rows.push(small(data.signer), small(data.position))
  rows.push({
    height: 6,
    exactHeight: true,
    vAlign: 'center',
    cells: [{ span: 6, content: text(model.signatureLine, 11) }],
  })
  rows.push(small(data.email), small(data.phone))

  return rows
}

/** Format angka rupiah tanpa "Rp": 1.500.000, atau "-" bila nol (seperti format template). */
export function formatMoneyNumber(value: number): string {
  return value === 0 ? '-' : Math.round(value).toLocaleString('id-ID')
}
