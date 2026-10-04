import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const lora = localFont({
  src: "../public/fonts/Lora.ttf",
  variable: "--font-lora",
  display: "swap",
});

const poppins = localFont({
  src: "../public/fonts/Poppins-Regular.ttf",
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maison Cavalier",
  description:
    "L'Immeuble Haute Couture — plateforme de conciergerie d'immeuble haut de gamme",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${lora.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
