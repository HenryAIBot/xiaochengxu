import Taro from "@tarojs/taro";
import type { ConsultationTargetRef } from "./api";

const STORAGE_KEY = "consultationContext";
const TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough to cross a tab-bar switch

export interface ConsultationContext {
  targetRef?: ConsultationTargetRef;
  sourceReportId?: string;
  sourceQueryTaskId?: string;
  /** Human-friendly label shown in the profile form prefill banner. */
  label?: string;
  savedAt: number;
}

export function setConsultationContext(
  ctx: Omit<ConsultationContext, "savedAt">,
) {
  try {
    Taro.setStorageSync(STORAGE_KEY, { ...ctx, savedAt: Date.now() });
  } catch {
    // non-fatal
  }
}

export function consumeConsultationContext(): ConsultationContext | null {
  let ctx: ConsultationContext | null = null;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === "object" && typeof raw.savedAt === "number") {
      if (Date.now() - raw.savedAt < TTL_MS) ctx = raw as ConsultationContext;
    }
  } catch {
    ctx = null;
  }
  try {
    Taro.removeStorageSync(STORAGE_KEY);
  } catch {
    // non-fatal
  }
  return ctx;
}
