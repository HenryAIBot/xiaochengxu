import { useEffect } from "react";
import { ensureUserToken } from "./lib/auth";

export default function App(props) {
  useEffect(() => {
    void ensureUserToken().catch((error) => {
      console.warn("[app] ensureUserToken failed:", error);
    });
  }, []);

  return props.children ?? null;
}
