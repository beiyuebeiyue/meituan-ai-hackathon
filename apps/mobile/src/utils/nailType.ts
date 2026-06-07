import type { NailType } from "../types/api";

export function getNailTypeLabel(nailType?: NailType | null) {
  return nailType === "handmade" ? "手工甲" : "穿戴甲";
}

export function getNailTypeTone(nailType?: NailType | null, isDark = false) {
  if (nailType === "handmade") {
    return isDark
      ? {
          backgroundColor: "#4a3215",
          borderColor: "rgba(255,202,96,0.54)",
          textColor: "#ffd27a",
        }
      : {
          backgroundColor: "#fff3d6",
          borderColor: "rgba(235,174,69,0.42)",
          textColor: "#8a5b00",
        };
  }

  return isDark
    ? {
        backgroundColor: "#12254f",
        borderColor: "rgba(88,166,255,0.5)",
        textColor: "#93c5fd",
      }
    : {
        backgroundColor: "#eaf3ff",
        borderColor: "rgba(96,165,250,0.42)",
        textColor: "#2563eb",
      };
}

export function isHandmadeNail(nailType?: NailType | null) {
  return nailType === "handmade";
}
