import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus IDE — Graph-Native Agentic Developer Environment",
  description: "Developer environment powered by FalkorDB AST knowledge graphs and deterministic multi-agent code refactoring.",
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
