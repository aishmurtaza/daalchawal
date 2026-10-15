"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { Navigation, ShieldAlert, CheckCircle2 } from "lucide-react";

function RiderTrackerContent() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const [status, setStatus] = useState("Initializing GPS tracking...");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by your browser");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setStatus(`Broadcasting GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

        try {
          await fetch("/api/rider/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, lat, lng }),
          });
        } catch (err) {
          console.error("Failed to broadcast location:", err);
        }
      },
      (error) => setStatus(`GPS Error: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [orderId]);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans space-y-6">
      <div className="p-4 bg-sky-500/20 border border-sky-500/30 rounded-full animate-pulse text-sky-400">
        <Navigation className="w-10 h-10" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black">🛵 Rider Live Navigation</h1>
        <p className="text-xs text-gray-400 font-mono">Order ID: {orderId}</p>
      </div>
      <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl text-center max-w-sm w-full font-mono text-xs text-sky-300 shadow-xl">
        {status}
      </div>
    </div>
  );
}

export default function RiderTracker() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-bold">Loading Rider GPS...</div>}>
      <RiderTrackerContent />
    </Suspense>
  );
}