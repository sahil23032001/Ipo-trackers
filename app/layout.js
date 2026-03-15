export const metadata = { title: 'IPO Intelligence', description: 'Indian IPO tracker powered by Groq AI' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#060b12', color: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
