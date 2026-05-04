'use client';
import React, { useEffect, useRef } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import type { GeoJsonObject, Feature } from 'geojson';
import type { Layer, PathOptions, LeafletMouseEvent } from 'leaflet';
import type { RegionMapData, Region } from '@/types';
import { getColorForStockLevel } from './useRegionColor';
import 'leaflet/dist/leaflet.css';

// Fix broken default marker icons from Webpack bundling
import L from 'leaflet';
// @ts-expect-error — Leaflet's default icon paths need patching
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const REGION_LABELS: Record<string, string> = {
  MY: 'Malaysia',
  ID: 'Indonesia',
  SG: 'Singapore',
};

const ISO_TO_REGION: Record<string, Region> = {
  MY: 'MY',
  ID: 'ID',
  SG: 'SG',
};

interface RegionClickInfo {
  id: Region;
  label: string;
}

interface MapInnerProps {
  regionData: RegionMapData[];
  onRegionClick: (region: RegionClickInfo) => void;
  onRegionHover: (region: RegionClickInfo | null, pos: { x: number; y: number } | null) => void;
}

function MapStyler({ regionData, onRegionClick, onRegionHover }: MapInnerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.zoomControl) return;
    // Remove zoom controls for clean look
    map.zoomControl.remove();
    // Dark background on map container
    const container = map.getContainer();
    container.style.background = '#0d1117';
  }, [map]);

  return null;
}

function GeoJSONLayer({ regionData, onRegionClick, onRegionHover, geoData }: MapInnerProps & { geoData: GeoJsonObject }) {
  const layerRef = useRef<L.GeoJSON | null>(null);
  const onRegionClickRef = useRef(onRegionClick);
  const onRegionHoverRef = useRef(onRegionHover);

  useEffect(() => { onRegionClickRef.current = onRegionClick; });
  useEffect(() => { onRegionHoverRef.current = onRegionHover; });

  const getRegionDataForFeature = (feature: Feature): RegionMapData | undefined => {
    const iso = (feature.properties as Record<string, string> | null)?.['ISO_A2'];
    if (!iso) return undefined;
    return regionData.find((d) => d.region === iso);
  };

  const getRegionIdForFeature = (feature: Feature): Region | undefined => {
    const iso = (feature.properties as Record<string, string> | null)?.['ISO_A2'];
    if (!iso) return undefined;
    return ISO_TO_REGION[iso];
  };

  const styleFeature = (feature: Feature | undefined): PathOptions => {
    if (!feature) return {};
    const rd = getRegionDataForFeature(feature);
    const level = rd?.stockLevel ?? 'none';
    const color = getColorForStockLevel(level);
    return {
      fillColor: color,
      fillOpacity: 0.35,
      weight: 1,
      color: `${color}99`,
    };
  };

  const onEachFeature = (feature: Feature, layer: Layer) => {
    const regionId = getRegionIdForFeature(feature);
    if (!regionId) return;

    const label = REGION_LABELS[regionId] ?? regionId;
    const rd = getRegionDataForFeature(feature);
    const level = rd?.stockLevel ?? 'none';
    const glowColor = getColorForStockLevel(level);

    layer.on('mouseover', (e: LeafletMouseEvent) => {
      const path = layer as L.Path;
      path.setStyle({ fillOpacity: 0.65, weight: 1.5, color: glowColor });
      onRegionHoverRef.current({ id: regionId, label }, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
    });

    layer.on('mousemove', (e: LeafletMouseEvent) => {
      onRegionHoverRef.current({ id: regionId, label }, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
    });

    layer.on('mouseout', () => {
      const path = layer as L.Path;
      path.setStyle({ fillOpacity: 0.35, weight: 1, color: `${glowColor}99` });
      onRegionHoverRef.current(null, null);
    });

    layer.on('click', () => {
      onRegionClickRef.current({ id: regionId, label });
    });
  };

  return (
    <GeoJSON
      ref={layerRef}
      data={geoData}
      style={(feature) => styleFeature(feature ?? ({} as Feature))}
      onEachFeature={onEachFeature}
    />
  );
}

export default function MapInner({ regionData, onRegionClick, onRegionHover }: MapInnerProps) {
  const [geoData, setGeoData] = React.useState<GeoJsonObject | null>(null);

  useEffect(() => {
    fetch('/geo/sea.json')
      .then((r) => r.json())
      .then((data: GeoJsonObject) => setGeoData(data))
      .catch(console.error);
  }, []);

  return (
    <div style={{ position: 'relative', aspectRatio: '420/310', background: '#0d1117', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <MapContainer
        key="leaflet-map"
        bounds={[[-11, 95], [7, 140]]}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging={false}
        style={{ width: '100%', height: '100%', background: '#0d1117' }}
        attributionControl={false}
      >
        <MapStyler regionData={regionData} onRegionClick={onRegionClick} onRegionHover={onRegionHover} />
        {geoData !== null && (
          <GeoJSONLayer
            geoData={geoData}
            regionData={regionData}
            onRegionClick={onRegionClick}
            onRegionHover={onRegionHover}
          />
        )}
      </MapContainer>

      {/* Watermark */}
      <div style={{ position: 'absolute', bottom: '8px', left: '10px', fontSize: '9px', color: '#2a2a2a', fontFamily: 'var(--font-mono)', pointerEvents: 'none', letterSpacing: '0.06em' }}>
        SOUTHEAST ASIA · JD SPORTS
      </div>
    </div>
  );
}
