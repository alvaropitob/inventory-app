import { ComplianceService } from "@/lib/services/compliance";
import { EquipmentService } from "@/lib/services/equipment";
import { getDateKeyInBusinessTimeZone, isValidDateKey } from "@/lib/dates";
import AuditDashboardUI from "./AuditDashboardUI";

export default async function AuditCompliancePage() {
  const [pendingVerifications, equipments] = await Promise.all([
    ComplianceService.getPendingVerifications(),
    EquipmentService.getEquipments()
  ]);

  const equipmentList = equipments.data || [];
  const totalEquipments = equipmentList.length;
  const operationalEquipments = equipmentList.filter(e => e.status === 'active').length;
  const todayKey = getDateKeyInBusinessTimeZone(new Date());
  const equipmentsWithCurrentMaintenance = equipmentList.filter(e => {
    if (e.status !== 'active' || !e.next_preventive_maintenance) return false;
    const nextMaintenanceDate = e.next_preventive_maintenance.slice(0, 10);
    return isValidDateKey(nextMaintenanceDate) && nextMaintenanceDate >= todayKey;
  }).length;
  const maintenanceCompliance = !equipments.error && totalEquipments > 0
    ? Math.round((equipmentsWithCurrentMaintenance / totalEquipments) * 1000) / 10
    : null;
  const pendingQuality = pendingVerifications.length;
  
  // Urgent maintenance: next 7 days
  const urgentMaintenance = equipmentList.filter(e =>
    e.next_preventive_maintenance && 
    new Date(e.next_preventive_maintenance) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );

  const dashboardData = {
    totalEquipments,
    operationalEquipments,
    pendingQuality,
    equipmentsWithCurrentMaintenance,
    maintenanceCompliance,
    equipmentDataAvailable: !equipments.error,
    urgentMaintenance
  };

  return <AuditDashboardUI data={dashboardData} />;
}
