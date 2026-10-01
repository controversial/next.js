// The documented opt-out that lets a route read request-time data with no <Suspense> above it.
export const instant = false;

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
