import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { HomeScreen } from "../../components/home-screen";
import { createQueryTask, listStoreProducts } from "../../lib/api";
import { saveQueryResult } from "../../lib/query-result-cache";

export default function HomePage() {
  return (
    <View>
      <HomeScreen
        onSubmit={async (payload) => {
          if (
            payload.tool === "infringement_check" &&
            /\s(store|shop)$/i.test(payload.input)
          ) {
            const candidates = await listStoreProducts(payload.input);
            Taro.setStorageSync("storeCandidates", candidates.items);
            Taro.navigateTo({ url: "/pages/select-product/index" });
            return;
          }

          const task = await createQueryTask(payload);
          saveQueryResult(task);
          Taro.navigateTo({
            url: `/pages/result/index?id=${task.id}`,
          });
        }}
      />
    </View>
  );
}
