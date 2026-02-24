import './globals.css';
import QueryProvider from '@/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'DMDevelon - Transforming Ideas into Digital Success',
  description: 'Professional web development, UI/UX design, and digital marketing services by Milan Drazic',
  keywords: 'web development, UI/UX design, digital marketing, portfolio, Milan Drazic, DMDevelon',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#2C2C2C',
                color: '#fff',
                border: '1px solid rgba(255, 182, 51, 0.3)',
              },
              success: {
                iconTheme: {
                  primary: '#FFB633',
                  secondary: '#0f0f10',
                },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
