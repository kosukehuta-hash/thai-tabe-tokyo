import type { SceneValue } from "@/lib/search-conditions";

export const SCENE_VALUES: readonly SceneValue[] = [
  "solo",
  "date",
  "friends",
  "family",
];

export const SCENE_LABEL: Record<SceneValue, string> = {
  solo: "ひとり",
  date: "デート",
  friends: "友人",
  family: "家族",
};

export const SCENE_OPTIONS: { value: SceneValue; label: string }[] =
  SCENE_VALUES.map((value) => ({ value, label: SCENE_LABEL[value] }));

type SceneFlags = {
  scene_solo: boolean;
  scene_date: boolean;
  scene_friends: boolean;
  scene_family: boolean;
};

const SCENE_FLAG_KEY: Record<SceneValue, keyof SceneFlags> = {
  solo: "scene_solo",
  date: "scene_date",
  friends: "scene_friends",
  family: "scene_family",
};

/** stores.scene_* の真偽値カラムから、該当するSceneValueのラベル一覧を返す。 */
export function getSceneLabels(store: SceneFlags): string[] {
  return SCENE_VALUES.filter((value) => store[SCENE_FLAG_KEY[value]]).map(
    (value) => SCENE_LABEL[value],
  );
}
