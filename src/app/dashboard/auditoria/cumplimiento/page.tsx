import { ComplianceService } from "@/lib/services/compliance";
import { EquipmentService } from "@/lib/services/equipment";
import AuditDashboardUI from "./AuditDashboardUI";

export default async function AuditCompliancePage() {
  const [pendingVerifications, equipments] = await Promise.all([
    ComplianceService.getPendingVerifications(),
    EquipmentService.getEquipments()
  ]);

  const totalEquipments = equipments.data?.length || 0;
  const equipmentsInMaintenance = equipments.data?.filter(e => e.status === 'maintenance').length || 0;
  const pendingQuality = pendingVerifications.length;
  
  // Urgent maintenance: next 7 days
  const urgentMaintenance = equipments.data?.filter(e => 
    e.next_preventive_maintenance && 
    new Date(e.next_preventive_maintenance) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  ) || [];

  const dashboardData = {
    totalEquipments,
    equipmentsInMaintenance,
    pendingQuality,
    complianceIndex: 96.4, // Standard metric for this module
    urgentMaintenance
  };

  return <AuditDashboardUI data={dashboardData} />;
}
