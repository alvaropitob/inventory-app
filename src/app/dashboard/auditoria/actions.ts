"use server";

import { requireRole } from "@/lib/supabase/authorization";

export async function getAuditLogs() {
  const { supabase } = await requireRole(["admin", "supervisor", "auditor"]);

  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      ip_address,
      user_agent,
      created_at,
      users:user_id (
        id,
        username,
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data;
}
