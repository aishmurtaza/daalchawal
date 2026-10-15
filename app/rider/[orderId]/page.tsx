"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RiderTracker() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const [status, setStatus] = useState("Initializing GPS...");

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

        await fetch("/api/rider/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, lat, lng }),
        });
      },
      (error) => setStatus(`GPS Error: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [orderId]);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-xl font-bold mb-4">🛵 Rider Live Navigation</h1>
      <p className="bg-gray-800 p-4 rounded-xl font-mono text-sm">{status}</p>
    </div>
  );
}