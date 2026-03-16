import { FurnitureTemplate, FurnitureCategory } from '../types/building';

export const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  office: 'Büro & Mobiliar',
  sanitary: 'Sanitär',
  hvac: 'HLKK & Technik',
  vehicle: 'Fahrzeuge',
  reception: 'Empfang & Tresen',
};

export const FURNITURE_TEMPLATES: FurnitureTemplate[] = [
  // ---- Office ----
  { id: 'desk-single', category: 'office', label: 'Schreibtisch', width: 1.6, depth: 0.8, height: 0.75, color: '#c8a87a', shape: 'rect' },
  { id: 'desk-l', category: 'office', label: 'L-Schreibtisch', width: 2.0, depth: 1.6, height: 0.75, color: '#c8a87a', shape: 'l-shape' },
  { id: 'desk-double', category: 'office', label: 'Doppelschreibtisch', width: 2.4, depth: 0.8, height: 0.75, color: '#c8a87a', shape: 'rect' },
  { id: 'chair-office', category: 'office', label: 'Bürostuhl', width: 0.6, depth: 0.6, height: 0.9, color: '#374151', shape: 'circle' },
  { id: 'cabinet-file', category: 'office', label: 'Aktenschrank', width: 0.8, depth: 0.4, height: 1.8, color: '#6b7280', shape: 'rect' },
  { id: 'shelf', category: 'office', label: 'Regal', width: 1.0, depth: 0.35, height: 2.0, color: '#a8956d', shape: 'rect' },
  { id: 'conference-table', category: 'office', label: 'Konferenztisch', width: 3.0, depth: 1.2, height: 0.75, color: '#c8a87a', shape: 'rect' },
  { id: 'sofa-2', category: 'office', label: 'Sofa 2-sitzig', width: 1.6, depth: 0.85, height: 0.75, color: '#64748b', shape: 'rect' },
  { id: 'sofa-3', category: 'office', label: 'Sofa 3-sitzig', width: 2.2, depth: 0.85, height: 0.75, color: '#64748b', shape: 'rect' },
  { id: 'printer', category: 'office', label: 'Drucker/Kopierer', width: 0.6, depth: 0.5, height: 1.0, color: '#9ca3af', shape: 'rect' },
  { id: 'server-rack', category: 'office', label: 'Server-Rack', width: 0.6, depth: 1.0, height: 2.0, color: '#1f2937', shape: 'rect' },

  // ---- Reception ----
  { id: 'reception-desk', category: 'reception', label: 'Empfangstresen', width: 3.0, depth: 0.8, height: 1.1, color: '#c8a87a', shape: 'rect' },
  { id: 'reception-desk-l', category: 'reception', label: 'Tresen L-Form', width: 3.0, depth: 1.6, height: 1.1, color: '#c8a87a', shape: 'l-shape' },
  { id: 'counter-bar', category: 'reception', label: 'Bartresen', width: 2.5, depth: 0.6, height: 1.1, color: '#92704d', shape: 'rect' },
  { id: 'waiting-chair', category: 'reception', label: 'Wartestuhl', width: 0.55, depth: 0.55, height: 0.8, color: '#64748b', shape: 'rect' },
  { id: 'display-case', category: 'reception', label: 'Vitrine', width: 1.0, depth: 0.4, height: 1.8, color: '#93c5fd', shape: 'rect' },

  // ---- Sanitary ----
  { id: 'wc', category: 'sanitary', label: 'WC', width: 0.36, depth: 0.7, height: 0.4, color: '#e2e8f0', shape: 'rect' },
  { id: 'urinal', category: 'sanitary', label: 'Urinal', width: 0.35, depth: 0.3, height: 0.6, color: '#e2e8f0', shape: 'rect' },
  { id: 'lavabo', category: 'sanitary', label: 'Lavabo', width: 0.6, depth: 0.45, height: 0.85, color: '#e2e8f0', shape: 'rect' },
  { id: 'lavabo-round', category: 'sanitary', label: 'Rundes Lavabo', width: 0.45, depth: 0.45, height: 0.85, color: '#e2e8f0', shape: 'circle' },
  { id: 'shower', category: 'sanitary', label: 'Dusche', width: 0.9, depth: 0.9, height: 0.1, color: '#bfdbfe', shape: 'rect' },
  { id: 'bathtub', category: 'sanitary', label: 'Badewanne', width: 1.7, depth: 0.75, height: 0.5, color: '#e0f2fe', shape: 'rect' },
  { id: 'sink-kitchen', category: 'sanitary', label: 'Küchenspüle', width: 0.8, depth: 0.5, height: 0.85, color: '#c0c0c0', shape: 'rect' },

  // ---- HVAC ----
  { id: 'ahu', category: 'hvac', label: 'Lüftungsanlage (AHU)', width: 2.5, depth: 1.2, height: 1.8, color: '#64748b', shape: 'rect' },
  { id: 'ahu-large', category: 'hvac', label: 'Lüftungsanlage groß', width: 4.0, depth: 2.0, height: 2.0, color: '#64748b', shape: 'rect' },
  { id: 'cooling-tower', category: 'hvac', label: 'Rückkühler', width: 2.0, depth: 2.0, height: 2.5, color: '#94a3b8', shape: 'rect' },
  { id: 'chiller', category: 'hvac', label: 'Kältemaschine', width: 2.5, depth: 1.5, height: 1.8, color: '#475569', shape: 'rect' },
  { id: 'heat-pump', category: 'hvac', label: 'Wärmepumpe', width: 1.2, depth: 0.8, height: 1.4, color: '#0ea5e9', shape: 'rect' },
  { id: 'heat-pump-large', category: 'hvac', label: 'Wärmepumpe groß', width: 2.0, depth: 1.2, height: 1.6, color: '#0ea5e9', shape: 'rect' },
  { id: 'boiler', category: 'hvac', label: 'Heizkessel', width: 0.8, depth: 0.8, height: 1.6, color: '#f97316', shape: 'rect' },
  { id: 'pump-station', category: 'hvac', label: 'Pumpenstation', width: 1.2, depth: 0.6, height: 1.2, color: '#3b82f6', shape: 'rect' },
  { id: 'electrical-panel', category: 'hvac', label: 'Elektroschaltschrank', width: 0.8, depth: 0.3, height: 2.0, color: '#1e3a5f', shape: 'rect' },
  { id: 'ups', category: 'hvac', label: 'USV / Batterieschrank', width: 0.8, depth: 0.6, height: 1.8, color: '#292524', shape: 'rect' },
  { id: 'outdoor-unit', category: 'hvac', label: 'Außeneinheit (Split)', width: 0.9, depth: 0.35, height: 0.7, color: '#cbd5e1', shape: 'rect' },

  // ---- Vehicles ----
  { id: 'car-small', category: 'vehicle', label: 'PKW klein', width: 4.2, depth: 1.8, height: 1.4, color: '#64748b', shape: 'rect' },
  { id: 'car-medium', category: 'vehicle', label: 'PKW mittel', width: 4.7, depth: 1.85, height: 1.5, color: '#64748b', shape: 'rect' },
  { id: 'car-suv', category: 'vehicle', label: 'SUV / Kombi', width: 4.9, depth: 2.0, height: 1.7, color: '#475569', shape: 'rect' },
  { id: 'van', category: 'vehicle', label: 'Transporter', width: 5.4, depth: 2.1, height: 2.3, color: '#374151', shape: 'rect' },
  { id: 'truck', category: 'vehicle', label: 'LKW', width: 8.0, depth: 2.5, height: 3.0, color: '#1f2937', shape: 'rect' },
  { id: 'forklift', category: 'vehicle', label: 'Gabelstapler', width: 2.5, depth: 1.2, height: 2.0, color: '#f59e0b', shape: 'rect' },
  { id: 'garage-door-single', category: 'vehicle', label: 'Rolltor (Single)', width: 3.0, depth: 0.3, height: 2.5, color: '#9ca3af', shape: 'rect' },
  { id: 'garage-door-double', category: 'vehicle', label: 'Rolltor (Double)', width: 5.0, depth: 0.3, height: 2.5, color: '#9ca3af', shape: 'rect' },
];

export const FURNITURE_BY_CATEGORY: Record<FurnitureCategory, FurnitureTemplate[]> = {
  office: FURNITURE_TEMPLATES.filter(t => t.category === 'office'),
  reception: FURNITURE_TEMPLATES.filter(t => t.category === 'reception'),
  sanitary: FURNITURE_TEMPLATES.filter(t => t.category === 'sanitary'),
  hvac: FURNITURE_TEMPLATES.filter(t => t.category === 'hvac'),
  vehicle: FURNITURE_TEMPLATES.filter(t => t.category === 'vehicle'),
};
