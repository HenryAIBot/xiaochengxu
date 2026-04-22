import { defineConfig } from "@tarojs/cli";

const pxtransformConfig = {
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
};

export default defineConfig({
  projectName: "xiaochengxu",
  date: "2026-04-15",
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  designWidth: 750,
  deviceRatio: pxtransformConfig.deviceRatio,
  mini: {
    webpackChain(chain) {
      chain.resolve.alias.set("@tarojs/shared", false);
    },
    postcss: {
      pxtransform: {
        enable: true,
        config: pxtransformConfig,
      },
    },
  },
  h5: {
    devServer: {
      port: 10086,
    },
    publicPath: "/",
    postcss: {
      // Disable pxtransform for H5: CSS is written in real browser px and
      // should not be converted to rpx/rem, which would shrink everything
      // ~40x on desktop viewports (see Taro's H5WebpackPlugin rootValue).
      pxtransform: {
        enable: false,
        config: pxtransformConfig,
      },
    },
  },
});
