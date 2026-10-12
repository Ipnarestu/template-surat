import JSZip from 'jszip'
import { readTemplateBytes } from './templateSource'
import type { QuotationData } from './quotationShared'

/**
 * Semua teks tetap surat (judul, label, syarat, kalimat penutup, dll.) dibaca
 * langsung dari file template Excel. Jadi PDF, Word, dan pratinjau selalu
 * memakai kata-kata yang sama persis dengan template; ubah template, semuanya ikut.
 */
export type TemplateModel = {
  logo: Uint8Array | null
  signatureImage?:string
stampImage?:string
  company: string
  addressLines: string[]
  title: string
  introduction: string
  labelDate: string
  labelNumber: string
  labelValidity: string
  /** Satuan masa berlaku, mis. "Days" dari contoh ": XX Days". */
  validitySuffix: string
  columnHeaders: string[]
  labelTotal: string
  labelTax: string
  labelGrandTotal: string
  termsTitle: string
  /** Baris syarat apa adanya: nomor di kolom A, teks di kolom B (baris lanjutan tanpa nomor). */
  termRows: { no: string; text: string }[]
  closing: string
  regards: string
  /** Nama perusahaan pada baris "Warm Regards" di template. */
  templateCompany: string
  signaturePlaceholders: string[]
  signatureLine: string
}

/** Lokasi sel pada template Surat Penawaran. */
export const CELL = {
  title: 'A8',
  introduction: 'A9',
  labelDate: 'E2',
  labelNumber: 'E3',
  labelValidity: 'E4',
  validity: 'F4',
  columnHeaders: ['A11', 'B11', 'C11', 'D11', 'E11', 'F11'],
  labelTotal: 'E15',
  labelTax: 'E16',
  labelGrandTotal: 'E17',
  termsTitle: 'A20',
  termRows: [
    ['A21', 'B21'],
    ['A22', 'B22'],
    ['A23', 'B23'],
    ['A24', 'B24'],
  ],
  closing: 'A26',
  regards: 'A28',
  company: 'A29',
  signature: ['A32', 'A33'],
  signatureLine: 'A38',
} as const

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function parse(xml: string): XMLDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Template Excel tidak dapat dibaca.')
  }
  return doc
}

/** Buang kode format header Excel (&L, &G, &"font", &14, dst.) sehingga tersisa teksnya. */
function headerLines(raw: string): string[] {
  return raw
    .replace(/&[LCR]/g, '')
    .replace(/&G/g, '')
    .replace(/&"[^"]*"/g, '')
    .replace(/&\d+/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

let modelPromise: Promise<TemplateModel> | null = null

export function loadTemplateModel(): Promise<TemplateModel> {
  if (!modelPromise) {
    modelPromise = readModel().catch((error) => {
      modelPromise = null
      throw error
    })
  }
  return modelPromise
}

async function readModel(): Promise<TemplateModel> {
  const zip = await JSZip.loadAsync(await readTemplateBytes())
  const sheetFile = zip.file('xl/worksheets/sheet1.xml')
  if (!sheetFile) throw new Error('Isi template Excel tidak lengkap.')
  const sheet = parse(await sheetFile.async('string'))

  const stringsFile = zip.file('xl/sharedStrings.xml')
  const strings = stringsFile
    ? Array.from(
        parse(await stringsFile.async('string')).getElementsByTagNameNS(
          SHEET_NS,
          'si',
        ),
      ).map((item) => item.textContent ?? '')
    : []

  const cells = new Map<string, Element>()
  for (const cell of Array.from(sheet.getElementsByTagNameNS(SHEET_NS, 'c'))) {
    cells.set(cell.getAttribute('r') ?? '', cell)
  }
  const text = (address: string): string => {
    const cell = cells.get(address)
    if (!cell) return ''
    const type = cell.getAttribute('t')
    if (type === 'inlineStr')
      return cell.getElementsByTagNameNS(SHEET_NS, 'is')[0]?.textContent ?? ''
    const value =
      cell.getElementsByTagNameNS(SHEET_NS, 'v')[0]?.textContent ?? ''
    return type === 's' ? (strings[Number(value)] ?? '') : value
  }

  const header = headerLines(
    sheet.getElementsByTagNameNS(SHEET_NS, 'oddHeader')[0]?.textContent ?? '',
  )
  const mediaName = Object.keys(zip.files).find((name) =>
    /^xl\/media\/[^/]+\.png$/i.test(name),
  )
  const logoEntry = mediaName ? zip.file(mediaName) : null

  const validitySuffix =
    /XX\s*(.+)$/i.exec(text(CELL.validity))?.[1]?.trim() || 'Days'

  return {
    logo: logoEntry ? await logoEntry.async('uint8array') : null,
    company: header[0] ?? '',
    addressLines: header.slice(1),
    title: text(CELL.title),
    introduction: text(CELL.introduction),
    labelDate: text(CELL.labelDate),
    labelNumber: text(CELL.labelNumber),
    labelValidity: text(CELL.labelValidity),
    validitySuffix,
    columnHeaders: CELL.columnHeaders.map(text),
    labelTotal: text(CELL.labelTotal),
    labelTax: text(CELL.labelTax),
    labelGrandTotal: text(CELL.labelGrandTotal),
    termsTitle: text(CELL.termsTitle),
    termRows: CELL.termRows.map(([no, body]) => ({
      no: text(no),
      text: text(body),
    })),
    closing: text(CELL.closing),
    regards: text(CELL.regards),
    templateCompany: text(CELL.company),
    signaturePlaceholders: CELL.signature.map(text),
    signatureLine: text(CELL.signatureLine),
  }
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[.\s]/g, '')

/**
 * Paragraf pembuka: teks yang diketik pengguna, atau kalimat bawaan template.
 * Bila nama perusahaan pengirim diganti, nama pada kalimat bawaan ikut diganti.
 */
export function getIntroduction(
  data: QuotationData,
  model: TemplateModel,
): string {
  const custom = data.introduction.trim()
  if (custom) return custom
  const sender = data.senderCompany.trim()
  if (
    !sender ||
    normalizeName(sender) === normalizeName(model.templateCompany)
  ) {
    return model.introduction
  }
  return model.introduction.replace(
    /PT\.?\s+Sinergi\s+Karunia\s+Sejahtera/i,
    sender,
  )
}

/** Nilai masa berlaku seperti di template, mis. ": 30 Days". */
export function validityText(
  data: QuotationData,
  model: TemplateModel,
): string {
  return `: ${data.validityDays} ${model.validitySuffix}`
}
