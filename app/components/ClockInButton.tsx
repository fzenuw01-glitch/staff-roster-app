"use client";

import { useState } from "react";
import { getCoordinates } from "@/lib/geolocation";
import { createBrowserClient } from "@supabase/ssr";

interface ClockInProps {
  shiftId: string;
  userRole: string; // e.g., 'manager', 'staff', 'admin', 'master'
  rosteredStart: string;
}

const isWithinRadius = (lat1: number, lng1: number, lat2: number, lng2: number, radius: number): boolean => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= radius;
};

export default function ClockInButton({ shiftId, userRole, rosteredStart }: ClockInProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleClockIn = async () => {
    setLoading(true);
    try {
      // 1. Get current user session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData.session;
      if (!session || !session.user) throw new Error('Not authenticated');

      // 2. Fetch User's Profile and their assigned Location details
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          location_id, 
          locations:location_id (latitude, longitude, radius_meters)
        `)
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Could not fetch profile.");
      }
      
      // 'locations' may be returned as an array from Supabase relation; handle both cases
      const loc = Array.isArray(profile.locations) ? profile.locations[0] : profile.locations;
      if (!loc) throw new Error("Location not assigned. Please contact an admin.");

      const { latitude, longitude, radius_meters } = loc as { latitude: number; longitude: number; radius_meters: number };

      // 3. Capture Location
    // 3. Capture Location
const coords = await getCoordinates();
      
      // 4. Geofence Check (Bypass for admins/managers/master)
      const onSite = isWithinRadius(coords.lat, coords.lng, latitude, longitude, radius_meters);
      
      if (!onSite && userRole !== "manager" && userRole !== "master" && userRole !== "admin") {
        throw new Error("You must be on-site at your assigned location to clock in.");
      }

      const now = new Date();
      const rostered = new Date(rosteredStart);
      const diffInMinutes = (now.getTime() - rostered.getTime()) / 60000;
      
      // 5. Role-Based Logic
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

      // 6. Update Supabase
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

    } catch (err: any) {
      console.error("Error clocking in:", err);
      alert(err.message || "Failed to clock in. Please ensure location services are enabled.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleClockIn} 
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
    >
      {loading ? "Verifying location..." : "Clock In"}
    </button>
  );
}