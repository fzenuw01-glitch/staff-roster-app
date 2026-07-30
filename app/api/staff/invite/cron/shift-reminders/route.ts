import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmailNotification } from '@/lib/email';
import moment from 'moment';

export async function GET(request: Request) {
  try {
    // Use the Supabase Service Role Key for backend cron jobs to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const todayStr = moment().format('YYYY-MM-DD');
    const now = moment();

    // Fetch today's shifts along with staff profile details
    const { data: shifts, error } = await supabase
      .from('daily_shifts')
      .select('*, profiles(full_name, email)')
      .eq('date', todayStr);

    if (error) throw error;

    let emailsSent = 0;

    for (const shift of shifts || []) {
      if (!shift.rostered_start || !shift.profiles?.email) continue;

      const startTimeStr = shift.rostered_start.slice(0, 5);
      const shiftStartDateTime = moment(`${todayStr} ${startTimeStr}`, 'YYYY-MM-DD HH:mm');
      const diffMins = shiftStartDateTime.diff(now, 'minutes');

      // Send reminder if the shift starts between 30 and 60 minutes from now
      if (diffMins >= 30 && diffMins <= 60) {
        const result = await sendEmailNotification({
          to: shift.profiles.email,
          subject: `Shift Reminder: Starting at ${startTimeStr}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Hello ${shift.profiles.full_name},</h2>
              <p>This is a quick reminder that your shift starts in about <strong>${diffMins} minutes</strong> (${startTimeStr}).</p>
              <p>Please remember to log in and clock in on time!</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #888;">Pay & Sleep Team Management System</p>
            </div>
          `,
        });

        if (result.success) {
          emailsSent++;
        }
      }
    }

    return NextResponse.json({ success: true, emailsSent });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}