import { Booking } from "../types/api";
import { AppPalette } from "./theme";

export const bookingStatusLabel: Record<Booking["status"], string> = {
  pending: "待处理",
  accepted: "已接受",
  rejected: "已拒绝",
  completed: "已完成",
  cancelled: "已取消",
};

export const merchantBookingStatusLabel: Record<Booking["status"], string> = {
  pending: "预约请求",
  accepted: "预约成功",
  rejected: "预约失败",
  completed: "订单完成",
  cancelled: "订单取消",
};

export function getBookingStatusTone(status: Booking["status"], colors: AppPalette) {
  if (status === "completed") {
    return {
      backgroundColor: colors.accentSoft,
      textColor: colors.accent,
    };
  }

  if (status === "rejected" || status === "cancelled") {
    return {
      backgroundColor: colors.surfaceAlt,
      textColor: colors.subtext,
    };
  }

  return {
    backgroundColor: colors.accentSoft,
    textColor: colors.accent,
  };
}

export function getBookingStatusTextColor(status: Booking["status"], colors: AppPalette) {
  return getBookingStatusTone(status, colors).textColor;
}
