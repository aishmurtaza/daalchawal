"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navigation, AlertCircle } from "lucide-react";

const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapPickerProps {
  onSelectLocation: (lat: number, lng: number) => void;
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

function LocationMarker({ position, setPosition, onSelectLocation }: any) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onSelectLocation(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : <Marker position={position} icon={customIcon} />;
}

export default function MapPicker({ onSelectLocation }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number]>([33.6844, 73.0479]);
  const [detecting, setDetecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const detectUserLocation = () => {
    if (!navigator.geolocation) {
      setNotice("Geolocation is not supported by your browser");
      return;
    }

    setDetecting(true);
    setNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition([lat, lng]);
        onSelectLocation(lat, lng);
        setDetecting(false);
        setNotice("GPS location detected successfully! ✓");
      },
      (err) => {
        console.warn("Geolocation warning/error:", err.message);
        const defaultLat = 33.6844;
        const defaultLng = 73.0479;
        setPosition([defaultLat, defaultLng]);
        onSelectLocation(defaultLat, defaultLng);
        setDetecting(false);
        setNotice("GPS timeout or blocked. Map centered—click anywhere on the map to pin your exact location.");
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={detectUserLocation}
        disabled={detecting}
        className="w-full bg-[#E6A15C]/20 hover:bg-[#E6A15C]/30 border border-[#E6A15C]/40 text-[#8C4A28] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
      >
        <Navigation className="w-3.5 h-3.5" />
        {detecting ? "Detecting GPS Location..." : "📍 Use My Current Location"}
      </button>

      {notice && (
        <div className="bg-[#F9F7F2] border border-[#E5DFD3] p-2 rounded-xl text-[11px] text-[#7A6B5D] flex items-center gap-1.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 text-[#E6A15C] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="h-48 w-full rounded-2xl overflow-hidden border border-[#E5DFD3] shadow-inner relative z-0">
        <MapContainer
          center={position}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <MapRecenter center={position} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker
            position={position}
            setPosition={setPosition}
            onSelectLocation={onSelectLocation}
          />
        </MapContainer>
      </div>
    </div>
  );
}