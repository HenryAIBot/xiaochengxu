import { View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { listMessages } from "../../lib/api";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Array<{ id: string; body: string }>>(
    [],
  );

  useEffect(() => {
    listMessages().then(setMessages);
  }, []);

  return <View>{messages[0]?.body ?? "暂无新消息"}</View>;
}
