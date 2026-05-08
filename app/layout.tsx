import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { ReactQueryClientProvider } from '@/components/providers/ReactQueryClientProvider';
import { ClientLayout } from '@/components/layout/ClientLayout';

export const metadata: Metadata = {
  title: 'My Google AI Studio App',
  description: 'My Google AI Studio App',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ReactQueryClientProvider>
          <ClientLayout>{children}</ClientLayout>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}
