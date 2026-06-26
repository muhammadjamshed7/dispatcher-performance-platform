import { AppProviders } from "@/components/providers/app-providers";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppProviders>{children}</AppProviders>;
}
