export function generatePdfDefinition(data: any) {
  return {
    content: [
      {
        columns: data.logo
          ? [
              {
                image: data.logo,
                width: 70,
                height: 70,
              },
              [
                { text: (data.header1 || '').toUpperCase(), style: 'header' },
                { text: (data.header2 || '').toUpperCase(), style: 'subheader' },
                { text: data.header3 || '', style: 'small' },
              ],
            ]
          : [
              {
                width: '*',
                alignment: 'center',
                stack: [
                  { text: (data.header1 || '').toUpperCase(), style: 'header' },
                  { text: (data.header2 || '').toUpperCase(), style: 'subheader' },
                  { text: data.header3 || '', style: 'small' },
                ],
              },
            ],
        columnGap: 10,
        margin: [0, 0, 0, 5],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1.5,
          },
        ],
        margin: [0, 0, 0, 15],
      },
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'Nomor       : ', bold: true },
              `${data.nomor_surat}\n`,
              { text: 'Lampiran  : ', bold: true },
              `${data.lampiran}\n`,
              { text: 'Perihal      : ', bold: true },
              `${data.perihal}\n`,
            ],
          },
          {
            width: 'auto',
            alignment: 'right',
            text: `${data.tempat_tanggal}`,
          },
        ],
        margin: [0, 0, 0, 15],
      },
      {
        text: [
          'Kepada Yth.\n',
          { text: `${data.tujuan_nama}\n`, bold: true },
          `${data.tujuan_jabatan ? data.tujuan_jabatan + '\n' : ''}`,
          `${data.tujuan_perusahaan ? data.tujuan_perusahaan + '\n' : ''}`,
          `${data.tujuan_alamat}\n\n`,
        ],
        margin: [0, 0, 0, 5],
      },
      {
        text: data.pembuka || 'Dengan hormat,\nBersama surat ini kami mengajukan permohonan pengadaan/permintaan barang untuk mendukung kebutuhan operasional dengan rincian sebagai berikut:',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 50, 50, 120],
          body: [
            [
              { text: 'No', style: 'tableHeader', alignment: 'center' },
              { text: 'Nama Barang / Spesifikasi', style: 'tableHeader' },
              { text: 'Jumlah', style: 'tableHeader', alignment: 'center' },
              { text: 'Satuan', style: 'tableHeader', alignment: 'center' },
              { text: 'Keterangan', style: 'tableHeader' },
            ],
            ...data.items.map((item: any, idx: number) => [
              { text: String(idx + 1), alignment: 'center' },
              item.nama || '-',
              { text: String(item.jumlah || 1), alignment: 'center' },
              { text: item.satuan || 'Pcs', alignment: 'center' },
              item.keterangan || '-',
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f1f5f9' : null),
        },
        margin: [0, 0, 0, 15],
      },
      {
        text: data.penutup || 'Demikian surat permintaan barang ini kami sampaikan. Atas perhatian, persetujuan, dan kerjasamanya kami ucapkan terima kasih.',
        margin: [0, 0, 0, 20],
      },
      {
        columns: [
          {
            width: '*',
            alignment: 'center',
            text: `${data.mengetahui_jabatan || 'Mengetahui,'}\n\n\n\n\n${data.mengetahui_nama ? `(${data.mengetahui_nama})` : ''}`,
          },
          {
            width: '*',
            alignment: 'center',
            text: `${data.pemohon_jabatan || 'Pemohon,'}\n\n\n\n\n(${data.pemohon_nama || 'Nama Pemohon'})`,
          },
        ],
      },
    ],
    styles: {
      header: {
        fontSize: 14,
        bold: true,
        alignment: 'center',
        lineHeight: 1.2,
      },
      subheader: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        lineHeight: 1.2,
      },
      small: {
        fontSize: 9,
        alignment: 'center',
        lineHeight: 1.1,
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: '#1e293b',
      },
    },
    defaultStyle: {
      fontSize: 10,
      lineHeight: 1.3,
    },
  }
}
