# Referee House

Every Match. Every Assignment. Every Achievement.

Referee House adalah ruang kerja berbahasa Indonesia untuk operasional wasit. Fase 1 menyediakan dasbor dengan zona waktu Asia/Jakarta dan mata uang IDR, identitas pengguna, serta pemisahan organisasi di PostgreSQL.

## Pratinjau lokal

Gunakan Node.js 24 LTS dan npm.

```sh
npm ci
npm run dev
```

Buka **http://localhost:3000**. Tanpa konfigurasi Supabase, server pengembangan menampilkan data fiktif dengan label **Data Demo**. Data demo berasal dari fixture TypeScript di `lib/demo.ts`. Agar lokal tanpa kredensial juga menampilkan halaman konfigurasi, salin `.env.example` ke `.env.local` dengan pengaturan demo bernilai `false`.

## Arsitektur

- `app/` memuat halaman, Server Actions autentikasi, dan status pemuatan. `proxy.ts` memperbarui sesi menggunakan cookie Supabase.
- `components/` memuat navigasi responsif, grafik Recharts, ringkasan, dialog detail, pencarian tampilan dan penugasan mendatang, serta pengalih tema.
- `lib/` memuat validasi respons dengan Zod, kontrak dasbor, peran, tanggal WIB, dan klien Supabase khusus server.
- `supabase/migrations/` memuat relasi dengan foreign key lintas tabel yang menyertakan ID organisasi, kebijakan Row-Level Security (RLS), dan fungsi baca. RPC dasbor mengevaluasi kebijakan pengguna saat memuat data. Hak super admin berasal dari skema privat dan hanya dapat diberikan melalui lingkungan database yang tepercaya.
- Tanggal filter mencakup hari mulai dan akhir di WIB. Total wasit menunjukkan direktori saat ini. Event dihitung jika tanggalnya beririsan dengan periode dan status waktunya dihitung per hari ini. Grafik menampilkan enam bulan hingga akhir periode terpilih. Nilai keuangan mengikuti tanggal pertandingan, dengan pembayaran berhasil yang dialokasikan pada persetujuan terkait.

## Menghubungkan Supabase

1. Siapkan proyek Supabase. Aktifkan penyedia Email dan nonaktifkan **Allow new users to sign up** bila akun hanya boleh dibuat oleh operator. Di **Authentication → URL Configuration**, tetapkan Site URL ke asal aplikasi Anda.
2. Jalankan `supabase/migrations/202611180001_foundation.sql` sekali melalui SQL Editor Supabase atau melalui CLI. Untuk CLI, gunakan `npx supabase login`, `npx supabase link --project-ref <project-ref>`, dan `npx supabase db push` dari akar proyek. Pertahankan `referee_private` di luar daftar skema yang diekspos Data API.
3. Buat akun admin yang telah dikonfirmasi melalui **Authentication → Users** atau proses undangan yang Anda kelola. Pastikan akun dapat masuk dengan kata sandi. Salin UUID akun yang benar.
4. Jalankan SQL berikut di SQL Editor sebagai pemilik proyek. Ganti nilai contoh. Foreign key memastikan UUID pengguna sudah terdaftar di Auth.

```sql
begin;

insert into public.profiles (id, full_name)
values ('00000000-0000-4000-8000-000000000000', 'Nama Admin')
on conflict (id) do update set full_name = excluded.full_name;

with organization as (
  insert into public.organizations (name, slug)
  values ('Nama Organisasi', 'nama-organisasi')
  returning id
)
insert into public.organization_memberships (org_id, user_id, role)
select id, '00000000-0000-4000-8000-000000000000'::uuid, 'organization_admin'
from organization;

commit;
```

5. Salin `.env.example` menjadi `.env.local`, isikan URL proyek dan **publishable key** Supabase, lalu mulai ulang server. Masuk melalui `/masuk`. Dasbor akan kosong sampai catatan operasional ditambahkan. Untuk mengaitkan akun wasit, buat keanggotaan berperan `referee` dan isi `referees.user_id` dengan UUID akun yang sama.
6. Simpan kunci service role dan kata sandi database di pengelola rahasia Anda. Aplikasi hanya membutuhkan URL dan publishable key, bersama sesi pengguna.

## Verifikasi

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Tes memakai PostgreSQL tersemat melalui PGlite dengan stub `auth.uid()`, serta data fiktif yang dibuat ulang di database tes. Tes menjalankan migrasi asli dan memeriksa cakupan organisasi, peran pengguna, visibilitas data pribadi, batas hari WIB, penolakan perubahan keanggotaan, serta perhitungan saldo atas alokasi parsial dan pembayaran yang dibalik. Uji masuk dan keluar terhadap proyek Supabase yang terhubung setelah pemasangan.

## Deployment GitHub → Vercel

1. Impor direktori proyek ini ke repositori GitHub Anda. Berkas yang dikecualikan mencakup `.env.local`, `node_modules`, dan `.next`.
2. Terapkan migrasi ke lingkungan Supabase tujuan. Gunakan proyek Supabase terpisah untuk Preview bila Preview memerlukan akses data.
3. Hubungkan repositori ke Vercel, pilih preset **Next.js**, gunakan Node.js 24.x, dan setel `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk lingkungan yang sesuai.
4. Deploy. Tetapkan Site URL Supabase ke domain Vercel tujuan. Verifikasi bahwa pengunjung diarahkan ke halaman masuk, akun tanpa keanggotaan ditolak, dan akun admin dapat membuka dasbor organisasinya.

### Deployment demo di Vercel

Untuk meninjau dashboard Fase 1 tanpa database, gunakan proyek Vercel khusus demo yang mengimpor repositori GitHub yang sama. Pilih preset **Next.js**, set Node.js ke 24.x, dan tambahkan `REFEREE_HOUSE_DEMO=true`. Biarkan kedua variabel Supabase kosong. Setelah deploy, halaman utama menampilkan **Data Demo**. Dengan salah satu variabel Supabase terisi, mode demo dinonaktifkan agar konfigurasi yang belum lengkap dapat terdeteksi.

## Status fase

- **Fase 1 tersedia:** fondasi autentikasi, peran, skema dan RLS, pemilih organisasi, dasbor, filter periode, grafik, daftar hingga 30 penugasan mendatang, ringkasan hingga 12 event aktif, dan ringkasan keuangan baca-saja. Panel notifikasi merangkum penugasan yang menunggu konfirmasi.
- **Fase 2 berikutnya:** direktori, pengelolaan event dan pertandingan, alur penugasan dan konfirmasi, ketersediaan, pencegahan benturan, dan kalender. Tambahkan operasi tulis dengan otorisasi dan audit di setiap transisi yang relevan.
- **Fase 3–6:** mesin tarif, simulator, persetujuan dengan riwayat tarif, pencatatan dan alokasi pembayaran transaksional, laporan, notifikasi persisten, pencarian lintas modul, dan validasi produksi lanjutan. Skema keuangan awal menyediakan model baca, dengan mutasi keuangan disiapkan untuk migrasi berikutnya.
