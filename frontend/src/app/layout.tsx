import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "SORTEO PLAYSTATION 5 SLIM + GTA | Guías Gaming Pro (PDF)",
  description:
    "Adquirí tus Guías Gaming Pro en formato PDF (Optimización de Red y FPS, Monitores 120Hz/144Hz y Catálogo de Trucos GTA) y participá con tus números de 5 cifras por una PlayStation 5 Slim + GTA el 19 de noviembre de 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable} dark`}>
      <body className="font-sans min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
