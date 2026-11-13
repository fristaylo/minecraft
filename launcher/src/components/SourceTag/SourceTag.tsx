import type { Source } from '@/api';

export function SourceTag({ source }: { source: Source }) {
  return <span className={`tag ${SOURCES[source].tone}`}>{SOURCES[source].label}</span>;
}

export function sourceLabel(source: Source): string {
  return SOURCES[source].label;
}

const SOURCES = {
  modrinth: { label: 'Modrinth', tone: 'mr' },
  curseforge: { label: 'CurseForge', tone: 'cf' },
  manual: { label: 'CurseForge', tone: 'cf' },
};
