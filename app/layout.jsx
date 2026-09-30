import "./globals.css";

export const metadata = {
  title: "IAMU AGA26 opening sequence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
