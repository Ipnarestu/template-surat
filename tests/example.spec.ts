import { test, expect } from '@playwright/test';

test('Tes Buka Halaman Surat Penawaran', async ({ page }) => {
  // 1. Minta Playwright membuka file HTML proyek Anda langsung dari penyimpanan komputer
  // Catatan: Jika Anda menggunakan Live Server (VS Code), ganti alamat di bawah dengan http://127.0.0
  await page.goto('file:///C:/ProjectSurat/SuratPenawaran/index.html');

  // 2. Mengambil screenshot pertama kali sebagai acuan (Golden Master)
  // Di pencarian berikutnya, jika ada tampilan yang bergeser atau berubah, tes akan gagal otomatis.
  await expect(page).toHaveScreenshot('tampilan-awal.png');
});
