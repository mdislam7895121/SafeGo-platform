import * as THREE from 'three';

export type VehicleType = 'sedan' | 'suv' | 'van' | 'truck' | 'motorcycle' | 'hatchback' | 'pickup' | 'car' | 'other';

export type VehicleColor = 
  | 'Black' | 'White' | 'Silver' | 'Gray' | 'Blue' | 'Red' 
  | 'Green' | 'Yellow' | 'Brown' | 'Gold' | 'Orange' | 'Beige' 
  | 'Purple' | 'Pink' | 'Other';

export const COLOR_MAP: Record<string, string> = {
  'Black': '#1a1a1a',
  'White': '#f5f5f5',
  'Silver': '#c0c0c0',
  'Gray': '#808080',
  'Blue': '#1e40af',
  'Red': '#dc2626',
  'Green': '#16a34a',
  'Yellow': '#eab308',
  'Brown': '#78350f',
  'Gold': '#ca8a04',
  'Orange': '#ea580c',
  'Beige': '#d4a574',
  'Purple': '#7c3aed',
  'Pink': '#ec4899',
  'Other': '#6b7280',
};

export const VEHICLE_TYPE_CONFIG: Record<VehicleType, {
  bodyScale: [number, number, number];
  roofHeight: number;
  roofScale: [number, number, number];
  roofOffset: number;
  wheelBaseWidth: number;
  wheelRadius: number;
  hoodLength: number;
  trunkLength: number;
}> = {
  sedan: {
    bodyScale: [3.2, 0.9, 1.4],
    roofHeight: 0.7,
    roofScale: [1.6, 0.6, 1.2],
    roofOffset: 0.1,
    wheelBaseWidth: 2.2,
    wheelRadius: 0.35,
    hoodLength: 0.7,
    trunkLength: 0.5,
  },
  suv: {
    bodyScale: [3.4, 1.2, 1.6],
    roofHeight: 0.9,
    roofScale: [2.4, 0.7, 1.4],
    roofOffset: 0,
    wheelBaseWidth: 2.4,
    wheelRadius: 0.45,
    hoodLength: 0.6,
    trunkLength: 0.4,
  },
  van: {
    bodyScale: [4.0, 1.4, 1.7],
    roofHeight: 1.0,
    roofScale: [3.4, 0.8, 1.5],
    roofOffset: -0.3,
    wheelBaseWidth: 2.8,
    wheelRadius: 0.4,
    hoodLength: 0.4,
    trunkLength: 0.2,
  },
  truck: {
    bodyScale: [4.5, 1.1, 1.5],
    roofHeight: 0.8,
    roofScale: [1.4, 0.7, 1.3],
    roofOffset: 0.8,
    wheelBaseWidth: 3.2,
    wheelRadius: 0.5,
    hoodLength: 0.8,
    trunkLength: 0,
  },
  pickup: {
    bodyScale: [4.2, 1.0, 1.5],
    roofHeight: 0.8,
    roofScale: [1.4, 0.7, 1.3],
    roofOffset: 0.6,
    wheelBaseWidth: 3.0,
    wheelRadius: 0.48,
    hoodLength: 0.7,
    trunkLength: 0,
  },
  hatchback: {
    bodyScale: [2.8, 0.85, 1.35],
    roofHeight: 0.65,
    roofScale: [1.8, 0.55, 1.15],
    roofOffset: -0.1,
    wheelBaseWidth: 2.0,
    wheelRadius: 0.32,
    hoodLength: 0.5,
    trunkLength: 0.3,
  },
  motorcycle: {
    bodyScale: [2.0, 0.4, 0.5],
    roofHeight: 0,
    roofScale: [0, 0, 0],
    roofOffset: 0,
    wheelBaseWidth: 1.4,
    wheelRadius: 0.35,
    hoodLength: 0,
    trunkLength: 0,
  },
  car: {
    bodyScale: [3.2, 0.9, 1.4],
    roofHeight: 0.7,
    roofScale: [1.6, 0.6, 1.2],
    roofOffset: 0.1,
    wheelBaseWidth: 2.2,
    wheelRadius: 0.35,
    hoodLength: 0.7,
    trunkLength: 0.5,
  },
  other: {
    bodyScale: [3.0, 0.9, 1.4],
    roofHeight: 0.7,
    roofScale: [1.6, 0.6, 1.2],
    roofOffset: 0.1,
    wheelBaseWidth: 2.2,
    wheelRadius: 0.35,
    hoodLength: 0.6,
    trunkLength: 0.4,
  },
};

export function normalizeVehicleType(type: string): VehicleType {
  const normalized = type?.toLowerCase().trim() || 'sedan';
  
  if (normalized.includes('suv') || normalized.includes('crossover')) return 'suv';
  if (normalized.includes('van') || normalized.includes('minivan')) return 'van';
  if (normalized.includes('truck')) return 'truck';
  if (normalized.includes('pickup')) return 'pickup';
  if (normalized.includes('hatchback') || normalized.includes('hatch')) return 'hatchback';
  if (normalized.includes('motorcycle') || normalized.includes('bike')) return 'motorcycle';
  if (normalized.includes('sedan') || normalized.includes('coupe')) return 'sedan';
  if (normalized === 'car') return 'sedan';
  
  return 'sedan';
}

export function getVehicleColor(colorName: string): THREE.Color {
  const hex = COLOR_MAP[colorName] || COLOR_MAP['Other'];
  return new THREE.Color(hex);
}

export function getVehicleColorHex(colorName: string): string {
  return COLOR_MAP[colorName] || COLOR_MAP['Other'];
}

export function createVehicleMaterial(colorName: string): THREE.MeshStandardMaterial {
  const color = getVehicleColor(colorName);
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.6,
    roughness: 0.3,
    envMapIntensity: 1.0,
  });
}

export function createGlassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a2030'),
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
  });
}

export function createWheelMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a2a2a'),
    metalness: 0.5,
    roughness: 0.6,
  });
}

export function createTireMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1a1a'),
    metalness: 0.1,
    roughness: 0.9,
  });
}

export function createHeadlightMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffee'),
    emissive: new THREE.Color('#ffffee'),
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.1,
  });
}

export function createTaillightMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cc0000'),
    emissive: new THREE.Color('#660000'),
    emissiveIntensity: 0.3,
    metalness: 0.7,
    roughness: 0.2,
  });
}
