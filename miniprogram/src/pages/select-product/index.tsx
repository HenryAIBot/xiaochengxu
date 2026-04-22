import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { StoreCandidateScreen } from "../../components/store-candidate-screen";
import { createQueryTask } from "../../lib/api";

export default function SelectProductPage() {
  const items = Taro.getStorageSync("storeCandidates") ?? [];

  return (
    <View>
      <StoreCandidateScreen
        items={items}
        onSelect={async (asin) => {
          const task = await createQueryTask({
            tool: "infringement_check",
            input: asin,
          });
          Taro.navigateTo({
            url: `/pages/result/index?id=${task.taskId}`,
          });
        }}
      />
    </View>
  );
}
