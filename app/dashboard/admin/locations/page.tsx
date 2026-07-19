"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr"; // Back to client-safe import

export default function LocationManager() {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState(50);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);

  // Initialize the client component client safely in the browser
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

  const fetchLocations = async () => {
    // Use RPC or fetch with cache-control if needed; Postgrest client doesn't expose headers on query builder
    const { data } = await supabase.from("locations").select("*");
    if (data) setLocations(data);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("locations").insert([
      { name, latitude: parseFloat(lat), longitude: parseFloat(lng), radius_meters: radius },
    ]);

    if (error) {
      alert("Error adding location: " + error.message);
    } else {
      alert("Location added successfully!");
      setName(""); setLat(""); setLng("");
      fetchLocations(); // Instantly refresh the list view
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Properties</h1>
      
      {/* Input Form */}
      <form onSubmit={handleAddLocation} className="flex flex-col gap-4 max-w-md mb-8">
        <input placeholder="Property Name" value={name} onChange={(e) => setName(e.target.value)} className="border p-2" required />
        <input placeholder="Latitude" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className="border p-2" required />
        <input placeholder="Longitude" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} className="border p-2" required />
        <input placeholder="Radius (meters)" type="number" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="border p-2" />
        <button type="submit" disabled={loading} className="bg-green-600 text-white p-2 rounded">
          {loading ? "Saving..." : "Add Property"}
        </button>
      </form>

      {/* List Display */}
      <h2 className="text-xl font-semibold mb-2">Current Properties</h2>
      <ul className="list-disc pl-5">
        {locations.map((loc) => (
          <li key={loc.id}>
            {loc.name} ({loc.latitude}, {loc.longitude}) - {loc.radius_meters}m
          </li>
        ))}
      </ul>
    </div>
  );
}