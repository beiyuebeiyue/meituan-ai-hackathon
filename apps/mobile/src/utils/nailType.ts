import type { NailType } from "../types/api";

export function getNailTypeLabel(nailType?: NailType | null) {
  return nailType === "handmade" ? "手工甲" : "穿戴甲";
}

export function getNailTypeTone(nailType?: NailType | null, isDark = false) {
  if (nailType === "handmade") {
    return isDark
      ? {
          backgroundColor: "#3a2414",
          borderColor: "#7c3f12",
          textColor: "#ffb86b",
        }
      : {
          backgroundColor: "#fff7ed",
          borderColor: "#fed7aa",
          textColor: "#c2410c",
        };
  }

  return isDark
    ? {
        backgroundColor: "#172554",
        borderColor: "#1d4ed8",
        textColor: "#93c5fd",
      }
    : {
        backgroundColor: "#eff6ff",
        borderColor: "#bfdbfe",
        textColor: "#1d4ed8",
      };
}

export function isHandmadeNail(nailType?: NailType | null) {
  return nailType === "handmade";
}
