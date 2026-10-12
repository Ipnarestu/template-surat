/**
 * Perkiraan pembungkusan teks Calibri (12 pt di template) untuk menentukan tinggi
 * baris Excel. Lebar huruf diambil dari font Carlito yang ukurannya identik dengan Calibri.
 */

/** Lebar huruf ASCII 32-126 dalam 1/1000 em. */
const ASCII_WIDTHS = [
  226, 326, 401, 498, 507, 715, 682, 221, 303, 303, 498, 498, 250, 306, 252,
  386, 507, 507, 507, 507, 507, 507, 507, 507, 507, 507, 268, 268, 498, 498,
  498, 463, 894, 579, 544, 533, 615, 488, 459, 631, 623, 252, 319, 520, 420,
  855, 646, 662, 517, 673, 543, 459, 487, 642, 567, 890, 519, 487, 468, 307,
  386, 307, 498, 498, 291, 479, 525, 423, 525, 498, 305, 471, 525, 229, 239,
  455, 229, 799, 525, 527, 525, 525, 349, 391, 335, 525, 452, 715, 433, 453,
  395, 314, 460, 314, 498,
]

/** Lebar huruf di luar ASCII (aksen, simbol) diperkirakan setengah em. */
const FALLBACK_WIDTH = 500

/**
 * Excel menggambar teks dengan lebar sedikit di atas metrik desain (pembulatan piksel),
 * jadi ruang yang dipakai dikurangi agar teks tidak pernah terpotong.
 */
const SAFETY = 0.92

function charWidth(char: string): number {
  const code = char.charCodeAt(0)
  return code >= 32 && code <= 126 ? ASCII_WIDTHS[code - 32] : FALLBACK_WIDTH
}

function textWidth(text: string, sizePt: number): number {
  let total = 0
  for (const char of text) total += charWidth(char)
  return (total * sizePt) / 1000
}

/** Jumlah baris teks setelah dibungkus per kata pada lebar kolom `widthPt` (poin). */
export function countLines(
  text: string,
  sizePt: number,
  widthPt: number,
): number {
  const limit = widthPt * SAFETY
  const space = textWidth(' ', sizePt)
  let lines = 0
  for (const paragraph of text.split(/\r?\n/)) {
    let used = 0
    let paragraphLines = 1
    for (const word of paragraph.split(' ')) {
      const width = textWidth(word, sizePt)
      if (used > 0 && used + space + width <= limit) {
        used += space + width
      } else if (used === 0 && width <= limit) {
        used = width
      } else {
        // Kata pindah ke baris berikutnya; kata yang lebih panjang dari kolom dipecah per huruf.
        if (used > 0) paragraphLines++
        used = width
        while (used > limit) {
          paragraphLines++
          used -= limit
        }
      }
    }
    lines += paragraphLines
  }
  return Math.max(1, lines)
}
