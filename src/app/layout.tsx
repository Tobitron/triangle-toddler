import "@/styles/globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Toddler Planner",
  description: "Smart suggestions for toddler activities in Chapel Hill",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex flex-col">
          <header className="px-4 py-3 border-b sticky top-0 bg-white z-10">
            <h1 className="text-lg font-semibold">Toddler Planner</h1>
            <p className="text-xs text-gray-500">Chapel Hill, NC</p>
          </header>
          <main className="flex-1 p-4 pb-24">{children}</main>
          <nav className="safe-bottom fixed bottom-0 left-0 right-0 border-t bg-white">
            <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
              <Tab href="/" label="Now" />
              <Tab href="/weekend" label="Weekend" />
              <Tab href="/history" label="History" />
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}

function Tab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-center py-3 text-sm font-medium text-gray-700 hover:text-gray-900"
    >
      {label}
    </Link>
  );
}
