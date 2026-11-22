export const reasonText: Record<string, { title: string; hint: string }> = {
  amount_mismatch: { title: 'Nominal mungkin salah baca', hint: 'Angka total tidak sama dengan subtotal ditambah pajak. Periksa pada gambar.' },
  amount_unverified: { title: 'Nominal belum diperiksa', hint: 'Dokumen pindai, jadi nominal perlu dicek petugas.' },
  total_mismatch: { title: 'Nominal berbeda dari catatan', hint: 'Total yang terbaca tidak sama dengan total invoice yang sudah tercatat.' },
  over_limit: { title: 'Melebihi sisa invoice', hint: 'Nominal transaksi lebih besar dari sisa yang boleh dipakai.' },
  exhausted: { title: 'Invoice sudah habis dipakai', hint: 'Tidak ada sisa nominal yang bisa digunakan.' },
  expired: { title: 'Sudah lewat batas waktu', hint: 'Lebih dari 3 bulan sejak jatuh waktu, tidak bisa dipakai sebagai underlying.' },
  support_needed: { title: 'Perlu dokumen pendukung', hint: 'Sudah jatuh waktu. Lampirkan MT 103 atau bukti transfer dan surat pernyataan.' },
  similar: { title: 'Mirip dengan invoice lain', hint: 'Petugas perlu memutuskan apakah ini invoice yang sama.' },
  identity_unknown: { title: 'Invoice tidak dapat dikenali', hint: 'Nomor atau penerbit tidak terbaca, jadi tidak bisa dicocokkan dengan catatan.' },
  missing_invoice_number: { title: 'Nomor invoice tidak terbaca', hint: 'Isi nomor invoice secara manual saat konfirmasi.' },
  missing_amount: { title: 'Nominal tidak terbaca', hint: 'Isi nominal dari gambar saat konfirmasi.' },
  missing_currency: { title: 'Mata uang tidak terbaca', hint: 'Isi mata uang saat konfirmasi.' },
  date_unknown: { title: 'Tanggal tidak terbaca', hint: 'Periksa tanggal terbit dan jatuh waktu pada gambar.' },
  unreadable: { title: 'Dokumen tidak terbaca', hint: 'Kualitas pindaian kurang. Unggah ulang dengan resolusi 300 dpi, lurus, tanpa bayangan.' },
  non_final: { title: 'Bukan dokumen final', hint: 'Proforma invoice atau penawaran tidak dapat dipakai sebagai underlying.' },
  language: { title: 'Bahasa tidak didukung', hint: 'Hanya bahasa Indonesia dan Inggris.' },
  ocr_low: { title: 'Hasil baca kurang yakin', hint: 'Kualitas pindaian rendah, periksa semua angka.' },
}
export const reasonOf = (r: { code: string; message: string }) =>
  reasonText[r.code] ?? { title: r.message, hint: '' }

export const matchText: Record<string, string> = {
  exact: 'Dikenali (sudah tercatat)',
  none: 'Invoice baru',
  near: 'Mirip invoice lain, perlu diputuskan',
  unidentified: 'Tidak dapat dikenali',
}
