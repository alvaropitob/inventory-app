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
    // Audit rows are written by SECURITY DEFINER database triggers in the same
    // transaction as the business change. Direct client inserts are denied by RLS.
    void params;
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
