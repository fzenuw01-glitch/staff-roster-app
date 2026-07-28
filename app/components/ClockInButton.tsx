"use client";

import { useState } from "react";
import { getCoordinates } from "@/lib/geolocation";
import { createBrowserClient } from "@supabase/ssr";

interface ClockInOutProps {
  shiftId: string;
  userRole: string;
  rosteredStart: string;
  rosteredEnd?: string;        // Added to check scheduled end time
  actualStart?: string | null; 
  actualEnd?: string | null;   
  onStatusChange?: () => void; 
}

const isWithinRadius = (lat1: number, lng1: number, lat2: number, lng2: number, radius: number): boolean => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= radius;
};

export default function ClockInButton({ 
  shiftId, 
  userRole, 
  rosteredStart, 
  rosteredEnd, 
  actualStart, 
  actualEnd, 
  onStatusChange 
}: ClockInOutProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isClockedIn = Boolean(actualStart) && !actualEnd;
  const isCompleted = Boolean(actualEnd);

  // Check if it's close to clock-out time (e.g., within 30 minutes of rostered end, or anytime for managers/admins)
  const now = new Date();
  let canClockOut = true;

  if (isClockedIn && rosteredEnd && userRole !== "manager" && userRole !== "master" && userRole !== "admin") {
    const endWindow = new Date(rosteredEnd).getTime() - (30 * 60 * 1000); // 30 mins before rostered end
    // If current time is BEFORE the allowed window, hide/disable the clock-out button to prevent accidental clicks
    if (now.getTime() < endWindow) {
      canClockOut = false;
    }
  }

  const handleClockAction = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData.session;
      if (!session || !session.user) throw new Error('Not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          location_id, 
          locations:location_id (latitude, longitude, radius_meters)
        `)
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) throw new Error("Could not fetch profile.");
      
      const loc = Array.isArray(profile.locations) ? profile.locations[0] : profile.locations;
      if (!loc) throw new Error("Location not assigned.");

      const { latitude, longitude, radius_meters } = loc as { latitude: number; longitude: number; radius_meters: number };
      const coords = await getCoordinates();
      
      const onSite = isWithinRadius(coords.lat, coords.lng, latitude, longitude, radius_meters);
      if (!onSite && userRole !== "manager" && userRole !== "master" && userRole !== "admin") {
        throw new Error("You must be on-site at your assigned location to clock in/out.");
      }

      if (isClockedIn) {
        const { error } = await supabase
          .from("daily_shifts")
          .update({
            actual_end: now.toISOString(),
            end_latitude: coords.lat,
            end_longitude: coords.lng,
          })
          .eq("id", shiftId);

        if (error) throw error;
        alert("Clocked out successfully!");
      } else {
        const rostered = new Date(rosteredStart);
        const diffInMinutes = (now.getTime() - rostered.getTime()) / 60000;
        
        let isOvertimeApproved = false;
        let statusReason = null;

        if (userRole === "manager" || userRole === "master" || userRole === "admin") {
          isOvertimeApproved = true; 
          statusReason = "Manager override";
        } else {
          if (diffInMinutes < -15) {
            isOvertimeApproved = false;
            statusReason = "Early clock-in outside grace period";
          } else {
            isOvertimeApproved = true;
          }
        }

        const { error } = await supabase
          .from("daily_shifts")
          .update({
            actual_start: now.toISOString(),
            start_latitude: coords.lat,
            start_longitude: coords.lng,
            is_overtime_approved: isOvertimeApproved,
            overtime_reason: statusReason
          })
          .eq("id", shiftId);

        if (error) throw error;
        alert("Clocked in successfully!");
      }

      if (onStatusChange) onStatusChange();

    } catch (err: any) {
      console.error("Error during clock action:", err);
      alert(err.message || "Failed to process clock action.");
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return <span className="text-xs font-bold text-slate-400 uppercase">Shift Completed</span>;
  }

  // If clocked in, but too early to clock out, display status text instead of a button
  if (isClockedIn && !canClockOut) {
    return (
      <div className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded border border-amber-200">
        Clock out unlocks near shift end
      </div>
    );
  }

  return (
    <button 
      onClick={handleClockAction} 
      disabled={loading}
      className={`px-4 py-2 rounded text-white font-bold transition disabled:opacity-50 cursor-pointer ${
        isClockedIn ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
      }`}
    >
      {loading ? "Verifying location..." : isClockedIn ? "Clock Out" : "Clock In"}
    </button>
  );
}