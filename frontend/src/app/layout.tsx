import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { preferenceBootScript } from "@/lib/preferences";

import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Ethos", template: "%s · Ethos" },
  description: "Personal command centre",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Ethos", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#14171c",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Dark is the default; the boot script may switch it before paint, hence suppressHydrationWarning.
    <html
      lang="en-GB"
      className={`dark ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceBootScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
