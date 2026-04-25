import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";
import { StoreCandidateScreen } from "../../components/store-candidate-screen";
import { createQueryTask } from "../../lib/api";

export default function SelectProductPage() {
  const items = Taro.getStorageSync("storeCandidates") ?? [];
  const dataSource = Taro.getStorageSync("storeCandidatesDataSource") ?? null;
  const [busyAsin, setBusyAsin] = useState<string | null>(null);

  return (
    <View>
      <StoreCandidateScreen
        items={items}
        busyAsin={busyAsin}
        dataSource={dataSource}
        onSelect={async (asin) => {
          if (busyAsin) return;
          setBusyAsin(asin);
          try {
            const task = await createQueryTask({
              tool: "infringement_check",
              input: asin,
            });
            Taro.navigateTo({
              url: `/pages/result/index?id=${task.taskId}`,
            });
          } catch (error) {
            const reason =
              error instanceof Error
                ? error.message
                : "创建检测任务失败，请稍后重试";
            Taro.showToast({ title: reason, icon: "none", duration: 3000 });
          } finally {
            setBusyAsin(null);
          }
        }}
      />
    </View>
  );
}
