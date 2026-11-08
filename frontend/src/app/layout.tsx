import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Ediciones & Sorteo | Biblioteca Digital con Chances Promocionales",
  description:
    "Adquirí nuestros eBooks en formato PDF con descarga inmediata y recibí números promocionales de 5 dígitos ('00000' a '99999') para el sorteo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans min-h-screen flex flex-col selection:bg-amber-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
