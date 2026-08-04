"use client";

import { useState } from "react";
import { getCoordinates } from "@/lib/geolocation";
import { createClient } from "@/lib/supabase";

interface ClockInOutProps {
  shiftId: string;
  userRole: string;
  rosteredStart: string;
  rosteredEnd?: string;
  actualStart?: string | null; 
  actualEnd?: string | null;   
  onStatusChange?: () => void; 
}

// Refactored to return the raw distance in meters instead of a boolean
const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); 
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
  const [debugInfo, setDebugInfo] = useState<string | null>(null); // Added debug state

  const supabase = createClient();

  const isClockedIn = Boolean(actualStart) && !actualEnd;
  const isCompleted = Boolean(actualEnd);

  const now = new Date();
  let canClockOut = true;

  // Added developer to the exempt roles for the clock-out window check
  const isExemptRole = ["manager", "master", "admin", "developer"].includes(userRole);

  if (isClockedIn && rosteredEnd && !isExemptRole) {
    const endWindow = new Date(rosteredEnd).getTime() - (30 * 60 * 1000); 
    if (now.getTime() < endWindow) {
      canClockOut = false;
    }
  }

  const handleClockAction = async () => {
    setLoading(true);
    setDebugInfo(null); // Reset debug info on new attempt
    
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

      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        throw new Error("Unable to retrieve device GPS location. Please ensure location services are enabled.");
      }

      const distanceInMeters = getDistance(coords.lat, coords.lng, latitude, longitude);
      const onSite = distanceInMeters <= radius_meters;

      // Explicitly log attempt for debugging if needed
      console.log(`Clock attempt - Device: (${coords.lat}, ${coords.lng}), Target: (${latitude}, ${longitude}), Distance: ${distanceInMeters}m, Allowed: ${radius_meters}m`);

      // Strictly block non-exempt staff if outside the radius
      if (!onSite && !isExemptRole) {
        throw new Error(`Clock-in blocked: You are ${distanceInMeters}m away from the site. You must be within ${radius_meters}m to clock in.`);
      }

      if (isClockedIn) {
        const { error } = await supabase
          .from("daily_shifts")
          .update({
            actual_finish: now.toISOString(), // Changed from actual_end
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

        if (isExemptRole) {
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

  if (isClockedIn && !canClockOut) {
    return (
      <div className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
        Clock out unlocks near shift end
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 w-full">
      <button 
        onClick={handleClockAction} 
        disabled={loading}
        className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm ${
          isClockedIn ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "Verifying location..." : isClockedIn ? "Clock Out" : "Clock In"}
      </button>
      
      {/* Debug string will appear here when you click the button */}
      {debugInfo && (
        <span className="text-xs text-slate-500 font-mono bg-slate-100 p-1 rounded">
          {debugInfo}
        </span>
      )}
    </div>
  );
}