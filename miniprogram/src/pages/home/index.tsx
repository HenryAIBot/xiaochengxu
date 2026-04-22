import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { HomeScreen } from "../../components/home-screen";
import { createQueryTask, listStoreProducts } from "../../lib/api";

export default function HomePage() {
  return (
    <View>
      <HomeScreen
        onSubmit={async (payload) => {
          if (!payload.input) {
            Taro.showToast({
              title: "请先输入检测对象",
              icon: "none",
            });
            return;
          }

          try {
            if (
              payload.tool === "infringement_check" &&
              /(\bstore|\bshop|店铺)$/i.test(payload.input)
            ) {
              const candidates = await listStoreProducts(payload.input);
              Taro.setStorageSync("storeCandidates", candidates.items);
              Taro.navigateTo({ url: "/pages/select-product/index" });
              return;
            }

            const task = await createQueryTask(payload);
            Taro.navigateTo({
              url: `/pages/result/index?id=${task.taskId}`,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "提交失败，请稍后重试";
            Taro.showToast({
              title: message,
              icon: "none",
              duration: 3000,
            });
          }
        }}
      />
    </View>
  );
}
