import { Providers } from './providers';

export const metadata = {
  title: 'SavingVault',
  description: 'High-yield USDC saving certificates',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

