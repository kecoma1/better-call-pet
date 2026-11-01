import { useEffect, useState } from "react";
import { checkDemoVideoAvailable } from "../services/demo-video";

export function useDemoVideoAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void checkDemoVideoAvailable().then((ok) => {
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);
  return available;
}
