import { Button, Text, View } from "@tarojs/components";

export function StoreCandidateScreen({
  items,
  busyAsin,
  onSelect,
}: {
  items: Array<{ asin: string; title: string }>;
  busyAsin?: string | null;
  onSelect(asin: string): void;
}) {
  if (items.length === 0) {
    return (
      <View className="page">
        <View className="state">
          <Text className="state__title">暂无可选商品</Text>
          <Text className="state__text">请返回首页重新输入店铺名</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="page">
      <View className="card">
        <Text className="card__title">选择要检测的商品</Text>
        <Text className="card__text">
          命中该店铺的商品，选一个进入 ASIN 级检测
        </Text>
      </View>
      <View>
        {items.map((item) => {
          const isBusy = busyAsin === item.asin;
          const anyBusy = Boolean(busyAsin);
          return (
            <View key={item.asin} className="list-item">
              <View className="list-item__row">
                <View style={{ flex: 1 }}>
                  <Text className="list-item__title">{item.title}</Text>
                  <Text className="list-item__sub">ASIN：{item.asin}</Text>
                </View>
                <Button
                  className={
                    anyBusy
                      ? "btn btn--primary btn--compact btn--disabled"
                      : "btn btn--primary btn--compact"
                  }
                  disabled={anyBusy}
                  onClick={() => onSelect(item.asin)}
                >
                  {isBusy ? "提交中…" : "检测"}
                </Button>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
