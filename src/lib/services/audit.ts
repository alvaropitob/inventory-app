import { createClient } from "@/lib/supabase/client";

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SECURITY_VIOLATION' | 'AUTH_SUCCESS' | 'AUTH_FAILURE';

export interface AuditLogParams {
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_data?: unknown;
  new_data?: unknown;
  user_id?: string;
  notes?: string;
}

export class AuditService {
  /**
   * Logs an action to the public.audit_logs table.
   * This is critical for ISO 15189 traceability.
   */
  static async logAction(params: AuditLogParams) {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          table_name: params.table_name,
          record_id: params.record_id,
          action: params.action,
          old_data: params.old_data,
          new_data: params.new_data,
          user_id: params.user_id || user?.id,
          // Metadata is captured by Postgres defaults or can be supplemented here
          user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server-side',
        });

      if (error) {
        console.error("Audit Logging Error:", error);
        // We don't throw here to avoid blocking the main business logic
        // but in a real production system, we might want a fallback
      }
    } catch (e) {
      console.error("Audit Service Exception:", e);
    }
  }

  /**
   * Specifically logs security violations or suspicious attempts.
   */
  static async logSecurityViolation(details: string, userId?: string) {
    return this.logAction({
      table_name: 'security',
      record_id: '00000000-0000-0000-0000-000000000000',
      action: 'SECURITY_VIOLATION',
      notes: details,
      user_id: userId
    });
  }
}
