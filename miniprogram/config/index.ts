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
      // Taro 4 under pnpm can emit a null alias for this package, but webpack 5.91
      // only accepts false/string here.
      chain.resolve.alias.set("@tarojs/shared", false);
    },
    postcss: {
      pxtransform: {
        enable: true,
      },
    },
  },
});
