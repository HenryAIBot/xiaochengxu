import { Text, View } from "@tarojs/components";
import type { TimelineEntry } from "../lib/query-result-view-model";

function openExternal(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

export function TimelineSection({
  timeline,
  title = "案件进展时间线",
}: {
  timeline: TimelineEntry[];
  title?: string;
}) {
  if (timeline.length === 0) return null;
  return (
    <View className="card">
      <Text className="card__title">{title}</Text>
      {timeline.map((entry, index) => (
        <View
          key={`${entry.at}-${index}`}
          className="evidence-item"
          style={{ marginTop: index === 0 ? "8px" : "12px" }}
        >
          <Text className="evidence-item__source">{entry.at}</Text>
          <Text className="evidence-item__body">{entry.event}</Text>
          {entry.documents && entry.documents.length > 0 ? (
            <View style={{ marginTop: "6px" }}>
              {entry.documents.map((doc, docIndex) => {
                const isAvailable = doc.isAvailable !== false;
                const label = doc.description ?? `附件 ${docIndex + 1}`;
                const meta = doc.pageCount ? `（${doc.pageCount} 页）` : "";
                if (!isAvailable) {
                  return (
                    <Text
                      key={doc.url}
                      className="evidence-item__source"
                      style={{ display: "block" }}
                    >
                      {label}
                      {meta}（已封存，需走 PACER）
                    </Text>
                  );
                }
                return (
                  <Text
                    key={doc.url}
                    className="evidence-item__link"
                    style={{ display: "block" }}
                    onClick={() => openExternal(doc.url)}
                  >
                    {label}
                    {meta} ↗
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
