import { LoginForm } from "@/components/features/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  // Comptes de démonstration : stack locale et démos uniquement.
  const demoPassword = process.env.DEMO_LOGIN === "true" ? process.env.DEMO_PASSWORD?.trim() || null : null;
  return <LoginForm demoPassword={demoPassword} linkError={erreur === "lien"} />;
}
