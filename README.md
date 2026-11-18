# Referee House

Every Match. Every Assignment. Every Achievement.

Referee House adalah ruang kerja berbahasa Indonesia untuk operasional wasit bola basket. Zona waktu jadwal adalah Asia/Jakarta (WIB) dan mata uang honor adalah IDR.

## Alur operasional basket

- **Komisi wasit** memakai peran `organization_admin`. Komisi dapat membuat event, mengatur roster, menetapkan atau melepas coach untuk event atau laga, serta membuat dan mencabut undangan.
- **Koordinator** membuat laga, mengubah jadwal, menugaskan Crew Chief dan dua Umpire, menyelesaikan laga, serta mencatat honor. **Referee Coach** memiliki kemampuan pengelolaan dalam cakupan event atau laga yang diberikan komisi. Peran coach bersifat kontekstual sehingga satu akun tetap dapat bertugas sebagai wasit di laga lainnya. Penugasan yang bertabrakan ditolak.
- **Wasit** melihat event yang diikuti, menerima atau menolak penugasan sendiri, dan meninjau honor. **Keuangan** mencatat pembayaran parsial atau penuh pada honor laga yang telah selesai. Aplikasi mencatat referensi pembayaran dengan jejak audit. Transfer atau pembayaran aktual dilakukan di luar aplikasi.
- Undangan **pengcab** membuat keanggotaan, sedangkan undangan **event** hanya menambahkan wasit ke roster event tersebut. Tautan terikat alamat email yang terverifikasi, berlaku tujuh hari, dan dapat dicabut oleh komisi. Bagikan tautan secara langsung kepada alamat yang diundang.

### Coba demo interaktif

Buka beranda dan pilih **Coba demo interaktif**. Buka **Event**, pilih **Buat event**, lalu simpan informasi event. Pada detail event, pilih **Tambah pertandingan** untuk menyusun jadwal. Tambahkan wasit ke roster dan buat penugasan dari **Wasit & Penugasan**, lalu gunakan pemilih **Simulasi peran** untuk menguji penerimaan tugas sebagai wasit. Kembali sebagai koordinator, buka detail laga dan pilih **Kelola pertandingan** untuk menyelesaikan laga, lalu catat honor dari halaman **Pembayaran**.

Buka **Data & Analisis** untuk melihat progres dan honor, pilih rentang tanggal atau daerah, lalu klik nama pada tabel untuk melihat detail. Filter tanggal memakai periode event dan mencakup pertandingan yang berada di dalam event terpilih.

Untuk menguji undangan lintas daerah, masuk sebagai komisi, buat tautan untuk satu event dari menu **Undangan**, dan buka tautannya di browser yang sama. Demo menyimpan data di penyimpanan lokal browser. Pendaftaran, akses lintas perangkat, dan email verifikasi memakai Supabase pada deployment operasional.

## Pratinjau lokal

Gunakan Node.js 24 LTS dan npm.

```sh
npm ci
npm run dev
```

Buka **http://localhost:3000**. Tanpa konfigurasi Supabase, server pengembangan menyediakan ruang kerja **Demo Interaktif**. Data demo berasal dari fixture TypeScript di `lib/operations/demo.ts`. Agar lokal tanpa kredensial juga menampilkan halaman konfigurasi, salin `.env.example` ke `.env.local` dengan pengaturan demo bernilai `false`.

## Arsitektur

- `app/` memuat halaman, Server Actions autentikasi, dan status pemuatan. `proxy.ts` memperbarui sesi menggunakan cookie Supabase.
- `components/` memuat navigasi responsif, grafik Recharts, ringkasan, dialog detail, pencarian tampilan dan penugasan mendatang, serta pengalih tema.
- `lib/` memuat validasi respons dengan Zod, kontrak dasbor, peran, tanggal WIB, dan klien Supabase khusus server.
- `supabase/migrations/` memuat relasi dengan foreign key lintas tabel yang menyertakan ID organisasi, kebijakan Row-Level Security (RLS), dan fungsi baca. RPC dasbor mengevaluasi kebijakan pengguna saat memuat data. Hak super admin berasal dari skema privat dan hanya dapat diberikan melalui lingkungan database yang tepercaya.
- Tanggal filter mencakup hari mulai dan akhir di WIB. Total wasit menunjukkan direktori saat ini. Event dihitung jika tanggalnya beririsan dengan periode dan status waktunya dihitung per hari ini. Grafik menampilkan enam bulan hingga akhir periode terpilih. Nilai keuangan mengikuti tanggal pertandingan, dengan pembayaran berhasil yang dialokasikan pada persetujuan terkait.

## Menghubungkan Supabase

1. Siapkan proyek Supabase. Aktifkan penyedia Email, **Allow new users to sign up**, dan **Confirm email**. Akun baru memerlukan undangan sebelum memiliki akses. Di **Authentication → URL Configuration**, tetapkan Site URL ke asal aplikasi Anda dan tambahkan callback `/auth/konfirmasi` untuk origin tersebut. Tautan konfirmasi pada pendaftaran melalui undangan juga membawa parameter `undangan`. Gunakan aturan allowlist khusus host dan jalur callback dengan pencocokan query jika diperlukan. Gunakan templat email konfirmasi Supabase yang memakai `{{ .ConfirmationURL }}` dan konfigurasikan SMTP untuk penerima eksternal.
2. Jalankan kedua migrasi SQL dalam `supabase/migrations/` secara berurutan melalui SQL Editor Supabase atau melalui CLI. Untuk CLI, gunakan `npx supabase login`, `npx supabase link --project-ref <project-ref>`, dan `npx supabase db push` dari akar proyek. Pertahankan `referee_private` di luar daftar skema yang diekspos Data API.
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

5. Salin `.env.example` menjadi `.env.local`, isikan URL proyek, **publishable key** Supabase, dan `REFEREE_HOUSE_APP_URL`, lalu mulai ulang server. Masuk melalui `/masuk`. Dasbor akan kosong sampai catatan operasional ditambahkan. Untuk mengaitkan akun wasit, buat keanggotaan berperan `referee` dan isi `referees.user_id` dengan UUID akun yang sama.
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
3. Hubungkan repositori ke Vercel, pilih preset **Next.js**, gunakan Node.js 24.x, dan setel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `REFEREE_HOUSE_APP_URL` untuk lingkungan yang sesuai. Hapus `REFEREE_HOUSE_DEMO` dari lingkungan operasional.
4. Deploy. Tetapkan Site URL Supabase ke domain Vercel tujuan. Verifikasi bahwa pengunjung diarahkan ke halaman masuk, akun tanpa keanggotaan ditolak, dan akun admin dapat membuka dasbor organisasinya.

### Deployment demo di Vercel

Untuk meninjau dashboard Fase 1 tanpa database, gunakan proyek Vercel khusus demo yang mengimpor repositori GitHub yang sama. Pilih preset **Next.js**, set Node.js ke 24.x, dan tambahkan `REFEREE_HOUSE_DEMO=true`. Biarkan kedua variabel Supabase kosong. Setelah deploy, beranda menampilkan tombol **Coba demo interaktif**. Dengan salah satu variabel Supabase terisi, mode demo dinonaktifkan agar konfigurasi yang belum lengkap dapat terdeteksi.

## Cakupan rilis basket

Rilis ini mencakup pengelolaan event, laga, roster, penugasan, coach, undangan, dan pencatatan honor. Hak akses yang sama diuji di PostgreSQL tersemat. Sebelum menggunakan akun asli, lakukan uji pendaftaran, konfirmasi email, penerimaan undangan lintas pengcab, dan pembayaran tercatat pada proyek Supabase yang sudah terhubung.
