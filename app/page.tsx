import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Link2,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { isDemo } from "@/lib/supabase/config";

const roles = [
  {
    title: "Komisi Wasit",
    icon: ShieldCheck,
    text: "Tetapkan coach, kelola roster pengcab, dan buat undangan khusus event.",
  },
  {
    title: "Koordinator & Referee Coach",
    icon: ClipboardList,
    text: "Susun jadwal, isi posisi kru, selesaikan laga, dan catat honor sesuai cakupan tugas.",
  },
  {
    title: "Wasit",
    icon: UsersRound,
    text: "Terima tugas, cek jadwal, dan lihat pembayaran dari pengcab atau event tamu.",
  },
];

export default function Home() {
  const demo = isDemo();
  return (
    <div className="basket-home">
      <header className="basket-nav">
        <div className="basket-inner">
          <Link href="/" aria-label="Referee House beranda">
            <Brand />
          </Link>
          <nav aria-label="Navigasi utama">
            <a href="#peran">Peran</a>
            <Link href="/masuk">Masuk</Link>
            <Link className="basket-nav-cta" href="/daftar">
              Daftar <ArrowRight size={15} />
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="basket-hero">
          <div className="basket-inner">
            <div className="basket-hero-copy">
              <p className="basket-tag">
                <Trophy size={15} /> OPERASIONAL WASIT BASKET
              </p>
              <h1>Kelola wasit untuk setiap pertandingan.</h1>
              <p>
                Susun jadwal, bentuk kru pertandingan, dan catat honor untuk
                event pengcab maupun lintas daerah.
              </p>
              <div className="basket-hero-actions">
                <Link className="basket-cta" href="/ruang-kerja">
                  {demo ? "Coba demo interaktif" : "Buka ruang kerja"}{" "}
                  <ArrowRight size={18} />
                </Link>
                <a href="#peran">Lihat alur peran</a>
              </div>
            </div>
          </div>
        </section>
        <div className="basket-inner basket-proof" aria-label="Fitur aplikasi">
          <div>
            <CalendarDays size={20} /> Jadwal & cek bentrok
          </div>
          <div>
            <Link2 size={20} /> Undangan lintas daerah
          </div>
          <div>
            <CircleDollarSign size={20} /> Pencatatan honor
          </div>
        </div>
        <section id="peran" className="basket-inner basket-roles">
          <div className="basket-roles-title">
            <h2>Satu ruang kerja, akses sesuai peran.</h2>
            <p>
              Komisi menetapkan Referee Coach untuk seluruh event atau satu
              laga. Wasit yang sama tetap bisa bertugas di laga lain.
            </p>
          </div>
          <div className="basket-role-grid">
            {roles.map(({ title, icon: Icon, text }) => (
              <article key={title}>
                <span className="tile blue">
                  <Icon size={21} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="basket-inner basket-footer">
        <Link href="/" aria-label="Referee House beranda">
          <Brand />
        </Link>
        <Link href="/ruang-kerja">
          {demo ? "Buka demo" : "Buka ruang kerja"} <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
