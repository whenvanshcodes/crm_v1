import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gaming Parlour OS',
  description: 'The Operating System for Gaming and Recreational Parlours',
  manifest: '/manifest.webmanifest'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('parlour_theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`
          }}
        />
        {children}
      </body>
    </html>
  )
}
