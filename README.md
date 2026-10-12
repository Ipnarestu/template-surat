# React + TypeScript + Vite

## Menjalankan Luma dan membuat Surat Penawaran

Pasang Node.js dan npm, lalu jalankan di folder proyek:

```cmd
npm ci
npm run dev
```

Buka alamat lokal yang ditampilkan Vite (biasanya `http://localhost:5173/`), lalu langsung ke `/surat/surat-penawaran` (atau **Daftar Surat → Surat Penawaran**).

**Cara pakai:** isi data penerima dan penawaran, isi **Tabel produk** (satu baris = satu produk; klik **Tambah baris** untuk produk berikutnya, baris kosong tidak ikut dicetak), lihat hasilnya langsung di panel **Pratinjau surat** (kanan layar, ikut berubah saat mengetik), lalu unduh sebagai **Excel (.xlsx)**, **PDF**, atau **Word (.docx)**. Kolom **Deskripsi penawaran** bisa diisi sendiri (kosong = kalimat bawaan template). Template sudah tersimpan di aplikasi; tidak perlu memilih file lagi.

**Template = satu sumber kebenaran.** File `public/templates/surat-penawaran.xlsx` adalah acuan. Excel diisi langsung ke file itu (logo, format, rumus), sedangkan PDF, Word, dan pratinjau membaca teks tetapnya (judul, label, syarat, kalimat penutup, kop) dari file yang sama dan digambar dengan ukuran persis template (lebar kolom, tinggi baris, margin, huruf 10/11/12 pt). Mengganti isi teks di template otomatis mengubah semua format. Struktur kode di `src/pages/surat/suratPenawaran/`:

- `index.tsx` form & tabel produk, `QuotationPreview.tsx` pratinjau
- `templateModel.ts` membaca teks template, `documentLayout.ts` daftar baris surat (dipakai PDF, Word, pratinjau)
- `exportExcel.ts`, `exportPdf.ts`, `exportWord.ts`, `quotationShared.ts`, `textMetrics.ts`, `templateSource.ts`

Pratinjau digambar dengan pdf.js sehingga tampil di semua browser tanpa penampil PDF bawaan. PDF memakai font Carlito (setara Calibri, lisensi OFL) di `public/fonts/`. File dibuat di browser tanpa database.

Untuk memeriksa build: `npm run build`. Hasil build berada di folder `dist`.

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
