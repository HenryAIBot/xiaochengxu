import { defineConfig } from "@tarojs/cli";

export default defineConfig({
  projectName: "xiaochengxu",
  date: "2026-04-15",
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  mini: {
    webpackChain(chain) {
      chain.resolve.alias.set("@tarojs/shared", false);
    },
    postcss: {
      pxtransform: {
        enable: true,
      },
    },
  },
  h5: {
    devServer: {
      port: 10086,
    },
    publicPath: "/",
    postcss: {
      pxtransform: {
        enable: true,
      },
    },
  },
});
