import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

const ROOT_PATHS = ["/", "/timetable", "/subjects", "/calendar", "/settings"];

export function BackButtonHandler() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isRoot = ROOT_PATHS.includes(currentPath);
  const lastPressRef = useRef<number>(0);

  useEffect(() => {
    if (!isRoot) return;

    // Push a dummy state to arm the guard
    window.history.pushState({ isRootGuard: true }, "", window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      const now = Date.now();
      const timeSinceLastPress = now - lastPressRef.current;

      if (timeSinceLastPress < 2000) {
        // Second press within 2 seconds -> exit the app / let system minimize
        window.history.go(-2);
      } else {
        // First press -> show toast, record time, and re-arm the guard
        lastPressRef.current = now;
        toast("Press back again to exit", { duration: 2000, position: "bottom-center" });
        window.history.pushState({ isRootGuard: true }, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isRoot, currentPath]);

  return null;
}
