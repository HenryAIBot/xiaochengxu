import { Button, Input, View } from "@tarojs/components";
import { useState } from "react";

type Tool = "infringement_check" | "tro_alert" | "case_progress";

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

export function HomeScreen({
  onSubmit,
}: {
  onSubmit(input: { tool: Tool; input: string }): void;
}) {
  const [tool, setTool] = useState<Tool>("infringement_check");
  const [value, setValue] = useState("");

  return (
    <View>
      <Input
        placeholder="品牌词 / 店铺名 / ASIN"
        value={value}
        onInput={(event) => setValue(readInputValue(event))}
        onChange={(event) => setValue(readInputValue(event))}
      />
      <Button onClick={() => setTool("infringement_check")}>侵权体检</Button>
      <Button onClick={() => setTool("tro_alert")}>TRO预警</Button>
      <Button onClick={() => setTool("case_progress")}>案件进展</Button>
      <Button onClick={() => onSubmit({ tool, input: value })}>立即检测</Button>
    </View>
  );
}
