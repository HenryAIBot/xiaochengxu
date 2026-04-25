import { Button, Input, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useCallback, useEffect, useState } from "react";
import {
  type ConsultationItem,
  type ConsultationTargetRef,
  createConsultation,
  listConsultations,
  updateConsultation,
} from "../../lib/api";
import {
  type ConsultationContext,
  consumeConsultationContext,
} from "../../lib/consultation-context";

const STATUS_LABELS: Record<string, string> = {
  pending: "待分配",
  assigned: "已分配顾问",
  in_progress: "处理中",
  closed: "已完成",
  done: "已完成",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "badge badge--watch",
  assigned: "badge badge--clear",
  in_progress: "badge badge--clear",
  closed: "badge",
  done: "badge",
};

const TARGET_KIND_LABELS: Record<ConsultationTargetRef["kind"], string> = {
  brand: "品牌",
  store: "店铺",
  asin: "ASIN",
  amazon_url: "商品链接",
  case_number: "案件号",
};

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ConsultationItem[]>([]);
  const [context, setContext] = useState<ConsultationContext | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await listConsultations();
      setItems(result.items);
    } catch {
      // keep previous list silently; retry by resubmitting
    }
  }, []);

  const refreshContext = useCallback(() => {
    const next = consumeConsultationContext();
    if (next) {
      setContext(next);
    }
  }, []);

  const nextStatus: Record<
    string,
    { status: ConsultationItem["status"]; label: string } | null
  > = {
    pending: { status: "in_progress", label: "标记处理中" },
    assigned: { status: "in_progress", label: "标记处理中" },
    in_progress: { status: "closed", label: "标记已完成" },
    closed: null,
    done: null,
  };

  async function advance(item: ConsultationItem) {
    const next = nextStatus[item.status];
    if (!next) return;
    try {
      await updateConsultation(item.id, { status: next.status });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
      setMessageTone("error");
    }
  }

  useDidShow(() => {
    refreshContext();
  });

  useEffect(() => {
    refreshContext();
    void load();
  }, [load, refreshContext]);

  async function submit() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const plusPrefix = trimmedPhone.startsWith("+") ? "+" : "";
    const normalizedPhone = plusPrefix + trimmedPhone.replace(/\D/g, "");
    if (!trimmedName) {
      setMessage("请填写姓名");
      setMessageTone("error");
      return;
    }
    if (!normalizedPhone || normalizedPhone === "+") {
      setMessage("请填写手机号");
      setMessageTone("error");
      return;
    }
    const phonePattern = /^\+?\d{7,15}$/;
    if (!phonePattern.test(normalizedPhone)) {
      setMessage(
        `手机号格式不正确：${normalizedPhone}（应为 7-15 位数字，可带 +）`,
      );
      setMessageTone("error");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const result = await createConsultation({
        name: trimmedName,
        phone: normalizedPhone,
        note: note.trim() || undefined,
        targetRef: context?.targetRef,
        sourceReportId: context?.sourceReportId,
        sourceQueryTaskId: context?.sourceQueryTaskId,
      });
      const advisorMsg = result.advisor
        ? `已分配给 ${result.advisor}，将尽快与您联系`
        : "已提交，我们会在分配顾问后尽快联系您";
      setMessage(advisorMsg);
      setMessageTone("ok");
      setName("");
      setPhone("");
      setNote("");
      setContext(null);
      await load();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "提交失败，请稍后重试";
      setMessage(reason);
      setMessageTone("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">顾问承接</Text>
        <Text className="app-header__subtitle">
          留下联系方式，顾问主动联系您
        </Text>
      </View>
      <View className="page">
        <View className="card">
          <Text className="card__title">提交咨询</Text>
          {context ? (
            <View
              className="evidence-item evidence-item--watch"
              style={{ marginBottom: "10px" }}
            >
              <Text className="evidence-item__title">
                本次咨询对象：{context.label ?? ""}
              </Text>
              {context.targetRef ? (
                <Text className="evidence-item__source">
                  {TARGET_KIND_LABELS[context.targetRef.kind]}：
                  {context.targetRef.value}
                </Text>
              ) : null}
              {context.sourceReportId ? (
                <Text className="evidence-item__body">
                  关联报告：{context.sourceReportId}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Input
            className="input"
            placeholder="姓名"
            value={name}
            onInput={(event) => setName(readInputValue(event))}
            onChange={(event) => setName(readInputValue(event))}
          />
          <Input
            className="input"
            placeholder="手机号"
            value={phone}
            onInput={(event) => setPhone(readInputValue(event))}
            onChange={(event) => setPhone(readInputValue(event))}
          />
          <Input
            className="input"
            placeholder="补充说明（可选）"
            value={note}
            onInput={(event) => setNote(readInputValue(event))}
            onChange={(event) => setNote(readInputValue(event))}
          />
          {message ? (
            <Text
              className={messageTone === "error" ? "hint hint--error" : "hint"}
            >
              {message}
            </Text>
          ) : null}
          <Button
            className="btn btn--primary btn--block"
            style={{ marginTop: "14px" }}
            onClick={submit}
          >
            {submitting ? "提交中…" : "提交咨询"}
          </Button>
        </View>

        <View className="card">
          <Text className="card__title">咨询记录</Text>
          {items.length === 0 ? (
            <Text className="card__text">暂无记录</Text>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                className="evidence-item evidence-item--watch"
                style={{ marginTop: "8px" }}
              >
                <Text className="evidence-item__title">
                  {item.name} · {item.phone}
                </Text>
                <Text className="evidence-item__source">
                  <Text className={STATUS_BADGE[item.status] ?? "badge"}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                  {item.advisor ? ` · 顾问：${item.advisor}` : ""}
                  {item.advisorSpecialty ? ` · ${item.advisorSpecialty}` : ""}
                </Text>
                {item.targetRef ? (
                  <Text className="evidence-item__body">
                    咨询对象：
                    {TARGET_KIND_LABELS[item.targetRef.kind]} ·{" "}
                    {item.targetRef.value}
                  </Text>
                ) : null}
                {item.note ? (
                  <Text className="evidence-item__body">备注：{item.note}</Text>
                ) : null}
                {nextStatus[item.status] ? (
                  <Button
                    className="btn btn--ghost btn--compact"
                    style={{ marginTop: "8px" }}
                    onClick={() => void advance(item)}
                  >
                    {nextStatus[item.status]?.label}
                  </Button>
                ) : null}
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
