import { ObjModel, ObjMaterial } from '../types/building';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function hexFromRgb(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseMtl(content: string): Map<string, ObjMaterial> {
  const materials = new Map<string, ObjMaterial>();
  let current: ObjMaterial | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === 'newmtl') {
      current = { name: parts[1] || 'default', color: '#cccccc', opacity: 1 };
      materials.set(current.name, current);
    } else if (current) {
      if (keyword === 'Kd') {
        current.color = hexFromRgb(
          parseFloat(parts[1]) || 0,
          parseFloat(parts[2]) || 0,
          parseFloat(parts[3]) || 0
        );
      } else if (keyword === 'd' || keyword === 'Tr') {
        const val = parseFloat(parts[1]) || 1;
        current.opacity = keyword === 'Tr' ? 1 - val : val;
      }
    }
  }

  return materials;
}

export async function parseObjFile(
  objContent: string,
  mtlContent: string | null,
  fileName: string
): Promise<ObjModel> {
  const vertices: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  const uvs: [number, number][] = [];
  const faces: ObjModel['faces'] = [];
  const materialsMap: Map<string, ObjMaterial> = mtlContent
    ? parseMtl(mtlContent)
    : new Map();

  let currentMaterial: string | undefined;

  for (const rawLine of objContent.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === 'v') {
      vertices.push([
        parseFloat(parts[1]) || 0,
        parseFloat(parts[2]) || 0,
        parseFloat(parts[3]) || 0
      ]);
    } else if (keyword === 'vn') {
      normals.push([
        parseFloat(parts[1]) || 0,
        parseFloat(parts[2]) || 0,
        parseFloat(parts[3]) || 0
      ]);
    } else if (keyword === 'vt') {
      uvs.push([
        parseFloat(parts[1]) || 0,
        parseFloat(parts[2]) || 0
      ]);
    } else if (keyword === 'usemtl') {
      currentMaterial = parts[1];
    } else if (keyword === 'f') {
      const vertexIndices: number[] = [];
      const normalIndices: number[] = [];
      const uvIndices: number[] = [];

      for (let i = 1; i < parts.length; i++) {
        const tokens = parts[i].split('/');
        const vi = parseInt(tokens[0]);
        const ti = tokens[1] ? parseInt(tokens[1]) : 0;
        const ni = tokens[2] ? parseInt(tokens[2]) : 0;

        vertexIndices.push(vi > 0 ? vi - 1 : vertices.length + vi);
        uvIndices.push(ti > 0 ? ti - 1 : (ti < 0 ? uvs.length + ti : -1));
        normalIndices.push(ni > 0 ? ni - 1 : (ni < 0 ? normals.length + ni : -1));
      }

      if (vertexIndices.length === 4) {
        faces.push({ vertexIndices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]], normalIndices: [normalIndices[0], normalIndices[1], normalIndices[2]], uvIndices: [uvIndices[0], uvIndices[1], uvIndices[2]], materialName: currentMaterial });
        faces.push({ vertexIndices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]], normalIndices: [normalIndices[0], normalIndices[2], normalIndices[3]], uvIndices: [uvIndices[0], uvIndices[2], uvIndices[3]], materialName: currentMaterial });
      } else if (vertexIndices.length >= 3) {
        for (let i = 1; i < vertexIndices.length - 1; i++) {
          faces.push({
            vertexIndices: [vertexIndices[0], vertexIndices[i], vertexIndices[i + 1]],
            normalIndices: [normalIndices[0], normalIndices[i], normalIndices[i + 1]],
            uvIndices: [uvIndices[0], uvIndices[i], uvIndices[i + 1]],
            materialName: currentMaterial
          });
        }
      }
    }
  }

  const materials: ObjMaterial[] = materialsMap.size > 0
    ? Array.from(materialsMap.values())
    : [{ name: 'default', color: '#cccccc', opacity: 1 }];

  const model: ObjModel = {
    id: generateId(),
    name: fileName.replace(/\.[^.]+$/, ''),
    fileName,
    vertices,
    normals,
    uvs,
    faces,
    materials,
    x: 0,
    y: 0,
    z: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    scale: 1,
    visible: true
  };

  return model;
}

export function getModelBounds(model: ObjModel): {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  centerX: number; centerY: number; centerZ: number;
  sizeX: number; sizeY: number; sizeZ: number;
} {
  if (model.vertices.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, centerX: 0, centerY: 0, centerZ: 0, sizeX: 0, sizeY: 0, sizeZ: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const [x, y, z] of model.vertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return {
    minX, maxX, minY, maxY, minZ, maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    sizeX: maxX - minX,
    sizeY: maxY - minY,
    sizeZ: maxZ - minZ
  };
}
