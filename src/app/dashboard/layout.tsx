import { getCurrentUserProfile } from "@/lib/services/user";
import { redirect } from "next/navigation";
import DashboardClientLayout from "@/components/DashboardClientLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardClientLayout user={user}>
      {children}
    </DashboardClientLayout>
  );
}
