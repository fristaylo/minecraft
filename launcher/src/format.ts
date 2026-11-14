import type { ManifestFile, Pack } from '@/api';

export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(2).replace('.', ',')} ГБ` : `${Math.round(mb)} МБ`;
}

export function modsWord(count: number): string {
  const rest = count % 10;
  const hundred = count % 100;
  if (rest === 1 && hundred !== 11) return `${count} мод`;
  return `${count} ${rest >= 2 && rest <= 4 && (hundred < 10 || hundred >= 20) ? 'мода' : 'модов'}`;
}

export const LOADERS = { vanilla: 'Vanilla', fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' };

export function formatLoader({ type, version }: Pack['loader']): string {
  return version ? `${LOADERS[type]} ${version}` : LOADERS[type];
}

export const SIDES = { both: 'Клиент и сервер', client: 'Только клиент', server: 'Только сервер' };

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export function needLabel(count: number): string {
  return `нужен ${count} ${count % 10 === 1 && count % 100 !== 11 ? 'моду' : 'модам'}`;
}

export function fileName(path: ManifestFile['path']): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function fileTitle({ meta, path }: Pick<ManifestFile, 'meta' | 'path'>): string {
  return meta?.title ?? fileName(path);
}

export function dependenciesOf(files: ManifestFile[], file: ManifestFile): ManifestFile[] {
  const ids = file.meta?.dependencies ?? [];
  return files.filter((other) => other.meta && ids.includes(other.meta.projectId));
}

export function dependentsOf(files: ManifestFile[], file: ManifestFile): ManifestFile[] {
  const id = file.meta?.projectId;
  return id ? files.filter((other) => other.meta?.dependencies.includes(id)) : [];
}

export function pathName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export const isMac = navigator.userAgent.includes('Mac');

export function instanceDir(gameDir: string, packId: Pack['id']): string {
  const sep = isMac ? '/' : '\\';
  return `${gameDir}${sep}instances${sep}${packId}`;
}
