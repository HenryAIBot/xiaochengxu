import { View } from "@tarojs/components";
import { ResultScreen } from "../../components/result-screen";

export default function ResultPage() {
  return (
    <View>
      <ResultScreen
        level="suspected_high"
        summary="检测到新案与商标风险信号。"
        actions={["立即复核 Listing", "联系顾问", "加入监控"]}
      />
    </View>
  );
}
