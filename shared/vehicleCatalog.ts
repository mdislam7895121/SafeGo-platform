// Comprehensive Vehicle Catalog for SafeGo Platform
// Provides standardized vehicle brands, models, and colors for consistent data capture

export type VehicleBrand = 
  | 'Toyota' | 'Honda' | 'Ford' | 'Chevrolet' | 'Nissan' 
  | 'Hyundai' | 'Kia' | 'Mazda' | 'Subaru' | 'Volkswagen'
  | 'BMW' | 'Mercedes-Benz' | 'Audi' | 'Lexus' | 'Tesla'
  | 'Jeep' | 'Ram' | 'GMC' | 'Dodge' | 'Buick'
  | 'Acura' | 'Infiniti' | 'Volvo' | 'Mitsubishi' | 'Other';

export const VEHICLE_COLORS = [
  'Black',
  'White',
  'Silver',
  'Gray',
  'Blue',
  'Red',
  'Green',
  'Yellow',
  'Brown',
  'Gold',
  'Orange',
  'Beige',
  'Purple',
  'Pink',
  'Other'
] as const;

export type VehicleColorOption = typeof VEHICLE_COLORS[number];

// Brand → Models mapping (180 models + "Other")
export const VEHICLE_BRANDS_MODELS: Record<VehicleBrand, string[]> = {
  Toyota: [
    'Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', 
    'Prius', 'Sienna', '4Runner', 'Avalon', 'C-HR', 'Sequoia', 'Other'
  ],
  Honda: [
    'Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'HR-V', 
    'Ridgeline', 'Passport', 'Insight', 'Fit', 'Other'
  ],
  Ford: [
    'F-150', 'Escape', 'Explorer', 'Mustang', 'Ranger', 'Edge',
    'Expedition', 'Bronco', 'Maverick', 'EcoSport', 'Transit', 'Other'
  ],
  Chevrolet: [
    'Silverado', 'Equinox', 'Malibu', 'Tahoe', 'Traverse', 'Colorado',
    'Camaro', 'Blazer', 'Suburban', 'Trax', 'Spark', 'Other'
  ],
  Nissan: [
    'Altima', 'Sentra', 'Rogue', 'Pathfinder', 'Frontier', 'Titan',
    'Kicks', 'Murano', 'Armada', 'Versa', 'Maxima', 'Other'
  ],
  Hyundai: [
    'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Kona', 'Palisade',
    'Venue', 'Accent', 'Ioniq', 'Veloster', 'Other'
  ],
  Kia: [
    'Forte', 'Optima', 'Sportage', 'Sorento', 'Soul', 'Telluride',
    'Seltos', 'Rio', 'Niro', 'Stinger', 'Carnival', 'Other'
  ],
  Mazda: [
    'Mazda3', 'Mazda6', 'CX-5', 'CX-9', 'CX-3', 'CX-30',
    'MX-5 Miata', 'CX-50', 'Other'
  ],
  Subaru: [
    'Outback', 'Forester', 'Crosstrek', 'Impreza', 'Ascent', 'Legacy',
    'WRX', 'BRZ', 'Other'
  ],
  Volkswagen: [
    'Jetta', 'Passat', 'Tiguan', 'Atlas', 'Golf', 'Taos',
    'Arteon', 'ID.4', 'Other'
  ],
  BMW: [
    '3 Series', '5 Series', '7 Series', 'X3', 'X5', 'X7',
    '2 Series', '4 Series', 'X1', 'iX', 'Other'
  ],
  'Mercedes-Benz': [
    'C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'GLS',
    'A-Class', 'CLA', 'GLB', 'EQS', 'Other'
  ],
  Audi: [
    'A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7',
    'Q8', 'e-tron', 'A5', 'Other'
  ],
  Lexus: [
    'ES', 'IS', 'RX', 'NX', 'GX', 'LX',
    'UX', 'LS', 'RC', 'Other'
  ],
  Tesla: [
    'Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck', 'Other'
  ],
  Jeep: [
    'Grand Cherokee', 'Wrangler', 'Cherokee', 'Compass', 'Renegade',
    'Gladiator', 'Wagoneer', 'Grand Wagoneer', 'Other'
  ],
  Ram: [
    '1500', '2500', '3500', 'ProMaster', 'ProMaster City', 'Other'
  ],
  GMC: [
    'Sierra', 'Terrain', 'Acadia', 'Yukon', 'Canyon', 'Hummer EV', 'Other'
  ],
  Dodge: [
    'Charger', 'Challenger', 'Durango', 'Hornet', 'Other'
  ],
  Buick: [
    'Encore', 'Envision', 'Enclave', 'Encore GX', 'Other'
  ],
  Acura: [
    'TLX', 'MDX', 'RDX', 'Integra', 'ILX', 'NSX', 'Other'
  ],
  Infiniti: [
    'Q50', 'Q60', 'QX50', 'QX60', 'QX80', 'Other'
  ],
  Volvo: [
    'S60', 'S90', 'V60', 'XC40', 'XC60', 'XC90', 'Other'
  ],
  Mitsubishi: [
    'Outlander', 'Eclipse Cross', 'Outlander Sport', 'Mirage', 'Other'
  ],
  Other: ['Other']
};

// Get all models for a specific brand
export function getModelsForBrand(brand: VehicleBrand): string[] {
  return VEHICLE_BRANDS_MODELS[brand] || ['Other'];
}

// Get all available brands
export function getAllBrands(): VehicleBrand[] {
  return Object.keys(VEHICLE_BRANDS_MODELS) as VehicleBrand[];
}

// Validate if a brand-model combination is valid
export function isValidBrandModel(brand: string, model: string): boolean {
  if (!brand || !model) return false;
  const models = VEHICLE_BRANDS_MODELS[brand as VehicleBrand];
  if (!models) return false;
  return models.includes(model) || model === 'Other';
}

// Helper to get color options with labels for UI
export function getColorOptions(): Array<{ value: string; label: string }> {
  return VEHICLE_COLORS.map(color => ({
    value: color,
    label: color
  }));
}

// Helper to get brand options for UI
export function getBrandOptions(): Array<{ value: string; label: string }> {
  return getAllBrands().map(brand => ({
    value: brand,
    label: brand
  }));
}

// Helper to get model options for a brand for UI
export function getModelOptions(brand: VehicleBrand): Array<{ value: string; label: string }> {
  const models = getModelsForBrand(brand);
  return models.map(model => ({
    value: model,
    label: model
  }));
}
