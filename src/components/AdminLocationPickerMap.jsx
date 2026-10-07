import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * RETHA Admin Panel — Interactive Location Picker Map Component (React / JSX)
 * 
 * Features:
 * - Rendered directly above Latitude / Longitude inputs
 * - Draggable luxury gold marker pin
 * - Click anywhere on map to position pin
 * - Bi-directional synchronization with Latitude & Longitude inputs
 * - OpenStreetMap tiles with dark theme styling
 * - Auto-invalidates size upon render to prevent invisible 0px map bug
 */
export const AdminLocationPickerMap = ({
  latitude,
  longitude,
  onCoordinatesChange,
  neighborhood = '',
  disabled = false
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);

  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);
  const hasValidCoords = !isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat !== 0 && parsedLng !== 0;

  const [currentCoords, setCurrentCoords] = useState({
    lat: hasValidCoords ? parsedLat : 24.7740,
    lng: hasValidCoords ? parsedLng : 46.6320,
    isSet: hasValidCoords
  });

  // Custom luxury gold SVG pin
  const createPinIcon = () => {
    return L.divIcon({
      className: 'admin-marker-pin-wrap',
      html: `
        <div class="admin-marker-pin" style="display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.65));cursor:grab;">
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
            <path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 44 17 44C17 44 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="#D4AF37"/>
            <circle cx="17" cy="17" r="7" fill="#0B0D13"/>
            <circle cx="17" cy="17" r="4" fill="#F4D375"/>
          </svg>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 44],
      popupAnchor: [0, -44]
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet map
    const defaultCenter = [
      hasValidCoords ? parsedLat : 24.7740,
      hasValidCoords ? parsedLng : 46.6320
    ];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: hasValidCoords ? 15 : 12,
      scrollWheelZoom: true
    });
    mapInstanceRef.current = map;

    // Standard OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);

    // Draggable gold pin marker
    const marker = L.marker(defaultCenter, {
      icon: createPinIcon(),
      draggable: !disabled,
      autoPan: true
    }).addTo(map);
    markerInstanceRef.current = marker;

    // Marker drag handler
    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      const newLat = parseFloat(pos.lat.toFixed(6));
      const newLng = parseFloat(pos.lng.toFixed(6));
      setCurrentCoords({ lat: newLat, lng: newLng, isSet: true });
      if (onCoordinatesChange) {
        onCoordinatesChange(newLat, newLng);
      }
    });

    // Map click handler to relocate pin
    map.on('click', (e) => {
      if (disabled) return;
      const { lat, lng } = e.latlng;
      const newLat = parseFloat(lat.toFixed(6));
      const newLng = parseFloat(lng.toFixed(6));
      marker.setLatLng([newLat, newLng]);
      setCurrentCoords({ lat: newLat, lng: newLng, isSet: true });
      if (onCoordinatesChange) {
        onCoordinatesChange(newLat, newLng);
      }
    });

    // Fix possible 0px height invisible map tile issue on initial render
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync external prop updates to map
  useEffect(() => {
    if (hasValidCoords && markerInstanceRef.current && mapInstanceRef.current) {
      const currentMarkerPos = markerInstanceRef.current.getLatLng();
      if (
        Math.abs(currentMarkerPos.lat - parsedLat) > 0.00001 ||
        Math.abs(currentMarkerPos.lng - parsedLng) > 0.00001
      ) {
        markerInstanceRef.current.setLatLng([parsedLat, parsedLng]);
        mapInstanceRef.current.panTo([parsedLat, parsedLng]);
        setCurrentCoords({ lat: parsedLat, lng: parsedLng, isSet: true });
      }
    }
  }, [latitude, longitude, hasValidCoords, parsedLat, parsedLng]);

  return (
    <div className="admin-map-picker-container" style={{
      marginTop: '10px',
      marginBottom: '18px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      overflow: 'hidden',
      background: '#11141b',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)'
    }}>
      <div className="admin-map-picker-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(0, 0, 0, 0.35)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        fontSize: '0.8rem',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span className="admin-map-instruction" style={{
          color: '#e2e8f0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.825rem'
        }}>
          <span className="map-pin-icon" style={{ fontSize: '1rem' }}>📍</span>
          <strong>Interactive Location Picker:</strong> Click map or drag marker to set exact coordinates
        </span>
        <span className="admin-map-coords-badge" style={{
          fontFamily: 'monospace',
          fontSize: '0.775rem',
          background: 'rgba(212, 175, 55, 0.12)',
          color: '#d4af37',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          padding: '3px 10px',
          borderRadius: '4px',
          fontWeight: 600,
          direction: 'ltr'
        }}>
          {currentCoords.isSet
            ? `${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}`
            : 'Click map to place pin'}
        </span>
      </div>

      {/* Actual Map Container Element */}
      <div
        ref={mapContainerRef}
        className="admin-property-picker-map"
        style={{
          height: '280px',
          width: '100%',
          minHeight: '280px',
          position: 'relative',
          zIndex: 1,
          background: '#0b0d13'
        }}
      />
    </div>
  );
};

export default AdminLocationPickerMap;
