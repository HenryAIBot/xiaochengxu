import { Button, Input, Text, View } from "@tarojs/components";
import { useCallback, useEffect, useState } from "react";
import {
  type ConsultationItem,
  createConsultation,
  listConsultations,
} from "../../lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "待分配",
  assigned: "已分配顾问",
  done: "已完成",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "badge badge--watch",
  assigned: "badge badge--clear",
  done: "badge",
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

  const load = useCallback(async () => {
    try {
      const result = await listConsultations();
      setItems(result.items);
    } catch {
      // keep previous list silently; retry by resubmitting
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    // Backend pattern: ^\+?\d{7,15}$ — strip everything except leading +
    // and digits so user-friendly inputs like "138 0013 8000",
    // "(86) 138-0013-8000" still pass validation.
    const plusPrefix = trimmedPhone.startsWith("+") ? "+" : "";
    const normalizedPhone = plusPrefix + trimmedPhone.replace(/\D/g, "");
    if (!trimmedName || !normalizedPhone || normalizedPhone === "+") {
      setMessage("请填写姓名和手机号");
      setMessageTone("error");
      return;
    }
    const phonePattern = /^\+?\d{7,15}$/;
    if (!phonePattern.test(normalizedPhone)) {
      setMessage("手机号格式不正确（7-15 位数字，可带 +）");
      setMessageTone("error");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await createConsultation({
        name: trimmedName,
        phone: normalizedPhone,
        note: note.trim() || undefined,
      });
      setMessage("已提交顾问咨询，我们会尽快联系您");
      setMessageTone("ok");
      setName("");
      setPhone("");
      setNote("");
      await load();
    } catch {
      setMessage("提交失败，请稍后重试");
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
                </Text>
                {item.note ? (
                  <Text className="evidence-item__body">备注：{item.note}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
