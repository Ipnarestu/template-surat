
import {
  COLUMN_WIDTHS_PT,
  FILL_COLORS,
  PAGE,
  TABLE_WIDTH_PT,
  buildLayoutRows,
  formatMoneyNumber,
  type Content,
  type LayoutRow,
} from './documentLayout'

import type { QuotationData } from './quotationShared'
import { loadTemplateModel, type TemplateModel } from './templateModel'

/**
 * Pengaturan ukuran gambar dalam satuan point (pt).
 * Ubah nilai width dan height sesuai kebutuhan.
 */
export const IMAGE_SIZES = {
  signature: {
    width: 100,
    height: 100,
  },
  stamp: {
    width: 100,
    height: 100,
  },
} as const

/** Data surat penawaran beserta gambar tanda tangan dan stempel. */
type QuotationDataWithImages = QuotationData & {
  signatureImage?: string
  stampImage?: string
}

/** Tinggi satu baris teks font Calibri/Carlito = 1,22 x ukuran huruf. */
const LINE_FACTOR = 1.22

/** Tinggi garis ganda di bawah baris rincian terakhir. */
const DOUBLE_RULE_HEIGHT = 2.25

const FONT_FILES = {
  normal: 'Carlito-Regular.ttf',
  bold: 'Carlito-Bold.ttf',
}

type PdfMakeModule = {
  createPdf: (
    definition: unknown,
    tableLayouts?: unknown,
    fonts?: unknown,
    vfs?: unknown,
  ) => {
    getBlob: (callback: (blob: Blob) => void) => void
  }
}

/** Mengubah byte menjadi Base64. */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunk),
    )
  }

  return btoa(binary)
}

let fontsPromise: Promise<Record<string, string>> | null = null

/** Muat font Carlito sekali saja. */
function loadFonts(): Promise<Record<string, string>> {
  if (!fontsPromise) {
    const load = async (file: string) => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}fonts/${file}`,
      )

      if (!response.ok) {
        throw new Error('File font untuk PDF tidak dapat diakses.')
      }

      return toBase64(new Uint8Array(await response.arrayBuffer()))
    }

    fontsPromise = Promise.all([
      load(FONT_FILES.normal),
      load(FONT_FILES.bold),
    ])
      .then(([normal, bold]) => ({
        [FONT_FILES.normal]: normal,
        [FONT_FILES.bold]: bold,
      }))
      .catch((error) => {
        fontsPromise = null
        throw error
      })
  }

  return fontsPromise
}

async function loadPdfMake(): Promise<PdfMakeModule> {
  const module = (await import('pdfmake/build/pdfmake')) as {
    default?: unknown
  }

  return (module.default ?? module) as PdfMakeModule
}

/**
 * Mengidentifikasi placeholder gambar berdasarkan teks pada template.
 * Foto akan ditempatkan pada sel tabel yang sama dengan placeholder.
 */
function getPlaceholderImage(
  content: Content | undefined,
  data: QuotationDataWithImages,
): string | undefined {
  if (!content || content.type === 'money') {
    return undefined
  }

  const text = content.text.toLowerCase()

  if (
    text.includes('[signature]') ||
    text.includes('[signatur')
  ) {
    return data.signatureImage
  }

  if (
    text.includes('[company stamp]') ||
    text.includes('[company-stamp]') ||
    text.includes('[stamp]')
  ) {
    return data.stampImage
  }

  return undefined
}

/** Mengambil ukuran gambar sesuai placeholder. */
function getImageSize(
  content: Content,
): { width: number; height: number } | undefined {
  if (content.type === 'money') {
    return undefined
  }

  const text = content.text.toLowerCase()

  if (
    text.includes('[signature]') ||
    text.includes('[signatur')
  ) {
    return IMAGE_SIZES.signature
  }

  if (
    text.includes('[company stamp]') ||
    text.includes('[company-stamp]') ||
    text.includes('[stamp]')
  ) {
    return IMAGE_SIZES.stamp
  }

  return undefined
}

/** Isi sel: teks biasa, nominal, atau gambar. */
function cellBody(
  content: Content,
  row: LayoutRow,
  narrow: boolean,
  data: QuotationDataWithImages,
) {
  const size = content.size
  const lineHeight = size * LINE_FACTOR
  const free = Math.max(0, row.height - lineHeight)

  const top =
    row.vAlign === 'top'
      ? 0
      : row.vAlign === 'center'
        ? free / 2
        : free

  // Jika sel berisi placeholder gambar dan gambar tersedia,
  // ganti teks placeholder dengan gambar.
  const placeholderImage = getPlaceholderImage(content, data)

  if (placeholderImage) {
    const imageSize = getImageSize(content)

    if (imageSize) {
      return {
        image: placeholderImage,
        fit: [imageSize.width, imageSize.height],
        alignment: 'left',
        margin: [0, 0, 0, 0],
      }
    }
  }

  // Jika gambar belum dipilih, placeholder tetap ditampilkan.
  if (content.type === 'money') {
    return {
      margin: [4, top, 4, 0],
      columnGap: 0,
      columns: [
        {
          text: 'Rp',
          width: 'auto',
          fontSize: size,
          bold: content.bold,
        },
        {
          text: formatMoneyNumber(content.value),
          width: '*',
          alignment: 'right',
          fontSize: size,
          bold: content.bold,
        },
      ],
    }
  }

  return {
    text: content.text,
    fontSize: size,
    bold: content.bold,
    decoration: content.underline ? 'underline' : undefined,
    alignment: content.align ?? 'left',
    margin: [narrow ? 0 : 2, top, narrow ? 0 : 2, 0],
    ...(row.exactHeight
      ? { lineHeight: row.height / lineHeight }
      : {}),
  }
}

function buildTable(
  rows: LayoutRow[],
  data: QuotationDataWithImages,
) {
  const body: unknown[][] = []
  const heights: number[] = []
  const fills: (string | null)[] = []
  const lines: Record<number, number> = {}

  rows.forEach((row) => {
    const tableIndex = body.length
    const cells: unknown[] = []
    let column = 0

    for (const cell of row.cells) {
      cells.push(
        cell.content
          ? {
              ...cellBody(
                cell.content,
                row,
                column === 0 && cell.span === 1,
                data,
              ),
              colSpan: cell.span,
            }
          : {
              text: '',
              colSpan: cell.span,
            },
      )

      column += cell.span

      for (let filler = 1; filler < cell.span; filler++) {
        cells.push({})
      }
    }

    body.push(cells)
    heights.push(row.height)
    fills.push(row.fill ? `#${FILL_COLORS[row.fill]}` : null)

    if (row.border === 'header') {
      lines[tableIndex] = 0.75
      lines[tableIndex + 1] = 0.75
    }

    if (row.border === 'double') {
      body.push([
        {
          colSpan: 6,
          stack: [
            {
              canvas: [
                {
                  type: 'line',
                  x1: 0,
                  y1: 0.4,
                  x2: TABLE_WIDTH_PT,
                  y2: 0.4,
                  lineWidth: 0.75,
                },
                {
                  type: 'line',
                  x1: 0,
                  y1: 1.9,
                  x2: TABLE_WIDTH_PT,
                  y2: 1.9,
                  lineWidth: 0.75,
                },
              ],
            },
          ],
        },
        {},
        {},
        {},
        {},
        {},
      ])

      heights.push(DOUBLE_RULE_HEIGHT)
      fills.push(null)
    }
  })

  return {
    table: {
      widths: [...COLUMN_WIDTHS_PT],
      body,
      heights: (index: number) => heights[index],
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (index: number) => lines[index] ?? 0,
      vLineWidth: () => 0,
      hLineColor: () => '#000000',
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      fillColor: (index: number) => fills[index],
    },
  }
}

function buildDefinition(
  inputData: QuotationData,
  model: TemplateModel,
) {
  const data = inputData as QuotationDataWithImages

  const logoRun = model.logo
    ? {
        image: `data:image/png;base64,${toBase64(model.logo)}`,
        width: 67.5,
        height: 56.5,
      }
    : {
        text: '',
        width: 67.5,
      }

  // Kop surat.
  const header = () => [
    {
      margin: [PAGE.left, PAGE.header, PAGE.right, 0],
      columns: [
        logoRun,
        {
          width: '*',
          alignment: 'right',
          stack: [
            {
              text: model.company,
              bold: true,
              fontSize: 14,
            },
            ...model.addressLines.map((line) => ({
              text: line,
              fontSize: 10,
            })),
          ],
        },
      ],
    },
    {
      absolutePosition: {
        x: PAGE.left,
        y: PAGE.top + PAGE.titleRule - DOUBLE_RULE_HEIGHT,
      },
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0.4,
          x2: TABLE_WIDTH_PT,
          y2: 0.4,
          lineWidth: 0.75,
        },
        {
          type: 'line',
          x1: 0,
          y1: 1.9,
          x2: TABLE_WIDTH_PT,
          y2: 1.9,
          lineWidth: 0.75,
        },
      ],
    },
  ]

  const footer = (currentPage: number, pageCount: number) => ({
    text: `Page ${currentPage} of ${pageCount}`,
    alignment: 'right',
    fontSize: 11,
    margin: [
      PAGE.left,
      PAGE.bottom - PAGE.footer - 11 * LINE_FACTOR + 1.2,
      PAGE.right,
      0,
    ],
  })

  return {
    pageSize: {
      width: PAGE.width,
      height: PAGE.height,
    },
    pageMargins: [
      PAGE.left,
      PAGE.top + PAGE.titleRule,
      PAGE.right,
      PAGE.bottom,
    ],
    defaultStyle: {
      font: 'Carlito',
      fontSize: 12,
    },
    info: {
      title: `Surat Penawaran ${data.number}`,
      author: data.senderCompany,
    },
    header,
    footer,

    // Gambar ditampilkan pada posisi placeholder di dalam tabel.
    // Tidak menambahkan gambar baru setelah tabel, agar tidak
    // terdorong ke halaman baru.
    content: [
      buildTable(buildLayoutRows(data, model), data),
    ],
  }
}

/** Buat PDF surat penawaran; fungsi ini juga dipakai untuk pratinjau. */
export async function createQuotationPdf(
  data: QuotationData,
): Promise<Blob> {
  const [pdfMake, fonts, model] = await Promise.all([
    loadPdfMake(),
    loadFonts(),
    loadTemplateModel(),
  ])

  const definition = buildDefinition(data, model)

  const fontMap = {
    Carlito: {
      normal: FONT_FILES.normal,
      bold: FONT_FILES.bold,
      italics: FONT_FILES.normal,
      bolditalics: FONT_FILES.bold,
    },
  }

  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake
        .createPdf(definition, undefined, fontMap, fonts)
        .getBlob(resolve)
    } catch {
      reject(new Error('Gagal membuat file PDF.'))
    }
  })
}