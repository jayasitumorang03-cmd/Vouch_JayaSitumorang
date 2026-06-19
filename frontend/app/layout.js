import './globals.css';

export const metadata = {
  title: 'Vouch Night Handover',
  description: 'Morning handover briefs for hotel front-desk managers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
