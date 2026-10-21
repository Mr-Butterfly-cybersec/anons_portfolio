import "./globals.css";

export const metadata = {
  title: "RIYANSHI'S WORLD // hacker-artist portal",
  description: "A hacker-artist playground — ephemeral CTF machines and hand-drawn art, all in one corner of the internet.",
  icons: {
    icon: "/icon-64.png",
    apple: "/icon-512.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
