import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { StoreCandidateScreen } from "../../components/store-candidate-screen";
import { createQueryTask } from "../../lib/api";
import { saveQueryResult } from "../../lib/query-result-cache";

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

          saveQueryResult(task);
          Taro.navigateTo({ url: `/pages/result/index?id=${task.id}` });
        }}
      />
    </View>
  );
}
