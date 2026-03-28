import type { Metadata } from "next";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { SwitchWalletDialog } from "@/components/SwitchWalletDialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idol Capsule — dynamic idol emotion NFT",
  description: "A blockchain-based dynamic NFT that reflects an idol’s mood in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <Providers>
          <Navbar />
          <SwitchWalletDialog />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
