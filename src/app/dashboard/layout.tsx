import { getCurrentUserProfile } from "@/lib/services/user";
import { redirect } from "next/navigation";
import DashboardClientLayout from "@/components/DashboardClientLayout";
import packageInfo from "../../../package.json";

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
    <DashboardClientLayout
      user={user}
      appVersion={process.env.NEXT_PUBLIC_APP_VERSION || packageInfo.version}
      deploymentEnvironment={process.env.VERCEL_ENV || (process.env.NODE_ENV === "production" ? "producción" : "desarrollo")}
    >
      {children}
    </DashboardClientLayout>
  );
}
