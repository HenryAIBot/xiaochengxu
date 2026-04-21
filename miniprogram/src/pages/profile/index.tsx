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
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ConsultationItem[]>([]);

  const load = useCallback(async () => {
    try {
      const result = await listConsultations();
      setItems(result.items);
    } catch {
      // silently keep previous list; user can try submitting again to retry
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setMessage("请填写姓名和手机号");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await createConsultation({
        name: trimmedName,
        phone: trimmedPhone,
        note: note.trim() || undefined,
      });
      setMessage("已提交顾问咨询，稍后会与您联系");
      setName("");
      setPhone("");
      setNote("");
      await load();
    } catch {
      setMessage("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <Text>顾问承接</Text>
      <Text>填写联系方式，我们的顾问会主动联系您。</Text>
      <Input
        placeholder="姓名"
        value={name}
        onInput={(event) => setName(readInputValue(event))}
        onChange={(event) => setName(readInputValue(event))}
      />
      <Input
        placeholder="手机号"
        value={phone}
        onInput={(event) => setPhone(readInputValue(event))}
        onChange={(event) => setPhone(readInputValue(event))}
      />
      <Input
        placeholder="补充说明（可选）"
        value={note}
        onInput={(event) => setNote(readInputValue(event))}
        onChange={(event) => setNote(readInputValue(event))}
      />
      {message ? <Text>{message}</Text> : null}
      <Button onClick={submit}>{submitting ? "提交中…" : "提交咨询"}</Button>

      <View>
        <Text>咨询记录</Text>
        {items.length === 0 ? (
          <Text>暂无记录</Text>
        ) : (
          items.map((item) => (
            <View key={item.id}>
              <Text>
                {item.name} · {item.phone}
              </Text>
              <Text>状态：{STATUS_LABELS[item.status] ?? item.status}</Text>
              {item.advisor ? <Text>顾问：{item.advisor}</Text> : null}
              {item.note ? <Text>备注：{item.note}</Text> : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
