"use client";

import { useEffect, useState } from "react";
import type { LocationData } from "./tree";

// One request per page load, shared by every component that needs locations (e.g. each location tab).
let request: Promise<LocationData> | null = null;

export function loadLocations(): Promise<LocationData> {
  request ??= fetch("/api/locations")
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `GET /api/locations failed: HTTP ${res.status}`);
      return body as LocationData;
    })
    .catch((err) => {
      request = null; // let a retry try again
      throw err;
    });
  return request;
}

export type LocationsState =
  | { status: "loading"; data: null }
  | { status: "ready"; data: LocationData }
  | { status: "error"; data: null; error: string };

/** ikman.lk's location tree for dropdowns, plus `retry()` after a failed load. */
export function useLocations(): LocationsState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LocationsState>({ status: "loading", data: null });

  useEffect(() => {
    let active = true;
    loadLocations().then(
      (data) => {
        if (active) setState({ status: "ready", data });
      },
      (err: unknown) => {
        console.error("[locations] ✖ Couldn't load districts/towns:", err);
        if (active) setState({ status: "error", data: null, error: err instanceof Error ? err.message : String(err) });
      }
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: "loading", data: null });
    setAttempt((n) => n + 1);
  };
  return { ...state, retry };
}
