import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referee House",
  description: "Kelola penugasan, pertandingan, dan kompensasi wasit.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme =
    (await cookies()).get("rh-theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="id" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
