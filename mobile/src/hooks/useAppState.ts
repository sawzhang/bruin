import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export function useAppState(onForeground: () => void) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          onForeground();
        }
        appState.current = nextState;
      }
    );
    return () => sub.remove();
  }, [onForeground]);
}
