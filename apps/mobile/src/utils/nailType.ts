import type { NailType } from "../types/api";

export function getNailTypeLabel(nailType?: NailType | null) {
  return nailType === "handmade" ? "手工甲" : "穿戴甲";
}

export function isHandmadeNail(nailType?: NailType | null) {
  return nailType === "handmade";
}
