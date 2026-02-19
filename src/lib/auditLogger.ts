import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'task_completed'
  | 'order_created'
  | 'order_approved_chef'
  | 'order_confirmed_manager'
  | 'order_rejected'
  | 'haccp_logged'
  | 'pin_changed'
  | 'pin_reset'
  | 'shift_added'
  | 'shift_deleted'
  | 'incident_created'
  | 'incident_resolved';

export async function logAudit(
  userId: string,
  userName: string,
  action: AuditAction,
  targetType?: string,
  targetId?: string,
  details?: Json
) {
  try {
    await supabase.from('audit_logs').insert([{
      user_id: userId,
      user_name: userName,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? null,
    }]);
  } catch (e) {
    // Non-blocking — never let audit errors crash the app
    console.warn('[audit]', e);
  }
}
