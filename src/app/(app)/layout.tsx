import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppShell
      user={{ id: user.id, fullName: user.fullName, role: user.role, departmentName: user.departmentName, position: user.position, dataScope: user.dataScope, preferences: user.preferences }}
    >
      {children}
    </AppShell>
  );
}
