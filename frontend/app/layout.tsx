import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EthicML Lab · Laboratorio de ética aplicada",
  description: "Evalúa modelos clásicos con experimentos reproducibles.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
