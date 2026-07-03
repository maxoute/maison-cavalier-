import { redirect } from "next/navigation";

// Le proxy redirige les utilisateurs connectés vers leur portail.
export default function Home() {
  redirect("/login");
}
