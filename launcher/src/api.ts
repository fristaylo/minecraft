import { invoke } from '@tauri-apps/api/core';

export type Role = 'pending' | 'user' | 'admin';
export type SkinModel = 'classic' | 'slim';
export type Theme = 'day' | 'dusk' | 'night' | 'dawn' | 'snow' | 'desert' | 'nether' | 'end';
export type LoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge';

export type Me = {
  id: string;
  name: string;
  role: Role;
  skin: { url: string; model: SkinModel } | null;
};

export type Pack = {
  id: string;
  name: string;
  theme: Theme;
  minecraft: string;
  loader: { type: LoaderType; version: string | null };
  version: string;
  size: number;
  server: string | null;
};

export type ManifestFile = {
  path: string;
  sha1: string;
  size: number;
  url: string;
  side: 'client' | 'server' | 'both';
  kind: 'mod' | 'resourcepack' | 'shader' | 'config';
  optional: boolean;
  defaultEnabled: boolean;
  policy: 'managed' | 'once';
  meta?: {
    title: string;
    author: string;
    description: string;
    iconUrl: string;
    gallery: string[];
    pageUrl: string;
    source: 'modrinth' | 'curseforge' | 'manual' | 'local' | 'custom';
    projectId: string;
    versionId: string;
    dependencies: string[];
  };
};

export type Meta = NonNullable<ManifestFile['meta']>;

export type Manifest = Pick<Pack, 'id' | 'name' | 'version' | 'minecraft' | 'loader' | 'server' | 'theme'> & {
  java: number | null;
  files: ManifestFile[];
  changelog: { kind: 'add' | 'upd' | 'del'; text: string }[];
};

export type ServerStatus = {
  online: boolean;
  players: { online: number; max: number; sample: string[] };
  ping: number | null;
};

export type LocalPackState = {
  installed_version: string | null;
  version: string;
  update_bytes: number;
  optional: Record<string, boolean>;
};

export type Settings = {
  ram_gb: number;
  window: { mode: 'window' | 'fullscreen'; width: number; height: number; maximized: boolean };
  java: { mode: 'auto' | 'custom'; path: string };
  jvm_args: string;
  after_launch: 'close' | 'hide' | 'keep';
  console: boolean;
  game_dir: string;
  auto_join: boolean;
};

export type LaunchProgress = {
  stage: string;
  label: string;
  done: number;
  total: number;
  bytes_done: number;
  bytes_total: number;
};

export type UpdateInfo = { version: string; notes: string | null };
export type UpdateProgress = { done: number; total: number | null };

export type AdminUser = {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
  hasSkin: boolean;
  whitelisted: boolean;
};

export const listPacks = () => invoke<Pack[]>('list_packs');
export const packManifest = (packId: Pack['id']) => invoke<Manifest>('pack_manifest', { packId });
export const serverStatus = () => invoke<ServerStatus>('server_status');
export const localPackState = (packId: Pack['id']) => invoke<LocalPackState>('local_pack_state', { packId });

export const play = (packId: Pack['id']) => invoke<void>('play', { packId });
export const cancelLaunch = () => invoke<void>('cancel_launch');
export const stopGame = () => invoke<void>('stop_game');

export const login = (username: string, password: string) => invoke<Me>('login', { username, password });
export const register = (username: string, password: string) => invoke<Me>('register', { username, password });
export const logout = () => invoke<void>('logout');
export const currentAccount = () => invoke<Me | null>('current_account');
export const uploadSkin = (path: string, model: SkinModel) => invoke<Me>('upload_skin', { path, model });
export const resetSkin = () => invoke<Me>('reset_skin');

export const getSettings = () => invoke<Settings>('get_settings');
export const saveSettings = (settings: Settings) => invoke<void>('save_settings', { settings });
export const systemMemory = () => invoke<number>('system_memory');

export const checkUpdate = () => invoke<UpdateInfo | null>('check_update');
export const installUpdate = () => invoke<void>('install_update');

export type Kind = ManifestFile['kind'];
export type Side = ManifestFile['side'];
export type Policy = ManifestFile['policy'];
export type Source = Meta['source'];
export type Market = Exclude<Source, 'manual' | 'local'>;
export type Scope = Market | 'both';

export type PackMeta = {
  name: string;
  theme: Theme;
  minecraft: string;
  loaderType: LoaderType;
  loaderVersion?: string;
  java: number;
  server?: string;
  gameServer: boolean;
};

export type AdminPack = Pick<PackMeta, 'name' | 'theme' | 'minecraft' | 'loaderType' | 'java' | 'gameServer'> &
  Pick<Pack, 'id' | 'server'> & { loaderVersion: string | null; version: string | null };

export type Version = {
  id: string;
  name: string;
  fileName: string;
  sha1: string;
  size: number;
  url: string | null;
  date: string;
  gameVersions: string[];
  loaders: string[];
  dependencies: { projectId: string; required: boolean }[];
};

export type Outcome = { draft: Manifest; added: string[]; incompatible: string[] };
export type Update = { path: ManifestFile['path']; latest: Version };
export type Published = { version: string; warnings: string[] };
export type Warning = { warning?: string };

export type SearchItem = Pick<Meta, 'title' | 'author' | 'description' | 'iconUrl'> & {
  source: Market;
  id: string;
  downloads: number;
  compatible: boolean;
};

export type ProjectDetails = {
  project: Pick<SearchItem, 'source' | 'id' | 'title' | 'author' | 'description' | 'iconUrl'> &
    Pick<Meta, 'gallery' | 'pageUrl'> & { body: string };
  versions: Version[];
};

type FileRef = { packId: Pack['id']; path: ManifestFile['path'] };

export const setOptional = (args: FileRef & { enabled: boolean }) => invoke<void>('set_optional', args);

export const listUsers = () => invoke<AdminUser[]>('list_users');
export const setRole = (args: Pick<AdminUser, 'id' | 'role'>) => invoke<Warning>('set_role', args);
export const deleteUser = (id: AdminUser['id']) => invoke<Warning>('delete_user', { id });

export const adminPacks = () => invoke<AdminPack[]>('admin_packs');
export const createPack = (id: Pack['id'], meta: PackMeta) => invoke<AdminPack>('create_pack', { id, meta });
export const setPackMeta = (packId: Pack['id'], meta: PackMeta) => invoke<Manifest>('set_pack_meta', { packId, meta });
export const deletePack = (packId: Pack['id']) => invoke<void>('delete_pack', { packId });
export const adminDraft = (packId: Pack['id'], reload: boolean) => invoke<Manifest>('admin_draft', { packId, reload });
export const addProject = (args: { packId: Pack['id']; source: Market; projectId: string; kind: Kind }) =>
  invoke<Outcome>('add_project', args);
export const removeEntry = (args: FileRef) => invoke<Manifest>('remove_entry', args);
export const setSide = (args: FileRef & { side: Side }) => invoke<Manifest>('set_side', args);
export const adminSetOptional = (args: FileRef & Pick<ManifestFile, 'optional' | 'defaultEnabled'>) =>
  invoke<Manifest>('admin_set_optional', args);
export const setPolicy = (args: FileRef & { policy: Policy }) => invoke<Manifest>('set_policy', args);
export const checkUpdates = (packId: Pack['id']) => invoke<Update[]>('check_updates', { packId });
export const applyUpdate = (args: FileRef) => invoke<Outcome>('apply_update', args);
export const openManualDownload = (args: FileRef) => invoke<void>('open_manual_download', args);
export const addConfigFiles = (args: { packId: Pack['id']; root: string; paths: string[]; policy: Policy }) =>
  invoke<Manifest>('add_config_files', args);
export const addLocalMod = (args: { packId: Pack['id']; path: string }) => invoke<Manifest>('add_local_mod', args);
export const publish = (args: { packId: Pack['id']; version: string; notes: string }) => invoke<Published>('publish', args);
export const search = (args: { query: string; source: Scope; kind: Kind; minecraft: string; loader: LoaderType }) =>
  invoke<SearchItem[]>('search', args);
export const projectDetails = (args: Pick<SearchItem, 'source' | 'id'>) =>
  invoke<ProjectDetails>('project_details', args);

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
