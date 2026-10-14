import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphiCode — Agentic IDE with Graph as Context",
  description: "Next-generation developer environment powered by FalkorDB AST graphs and dual-agent reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="h-full w-full overflow-hidden bg-[#141414] text-[#e5e5e5]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
