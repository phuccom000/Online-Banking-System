import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Apex Vault Bank',
  description: 'On-chain term deposits with NFT certificates',
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
