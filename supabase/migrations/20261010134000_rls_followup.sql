-- Corrections must be reviewed only by the atomic function, which also updates attendance and writes the audit record.
drop policy if exists correction_request_admin_update on public.attendance_correction_requests;
revoke update, delete on public.attendance_correction_requests from anon, authenticated;
grant select, insert on public.attendance_correction_requests to authenticated;

-- A read receipt is valid only while the user can read the targeted published notice.
drop policy if exists announcement_reads_update on public.announcement_reads;
create policy announcement_reads_update on public.announcement_reads for update to authenticated
using (user_id = auth.uid() and public.can_read_announcement(announcement_id))
with check (user_id = auth.uid() and public.can_read_announcement(announcement_id));
