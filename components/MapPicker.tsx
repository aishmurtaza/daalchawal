"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LocationMarker({ position, setPosition }: { position: [number, number]; setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position === null ? null : <Marker position={position} icon={icon}></Marker>;
}

export default function MapPicker({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<[number, number]>([24.8607, 67.0011]); // Default center (e.g., Karachi/local hub)

  useEffect(() => {
    onSelectLocation(position[0], position[1]);
  }, [position, onSelectLocation]);

  return (
    <div className="h-64 w-full rounded-2xl overflow-hidden border border-[#E5DFD3] z-0">
      <MapContainer center={position} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>
    </div>
  );
}