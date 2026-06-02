import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Gestion",
  description: "Project Management Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
