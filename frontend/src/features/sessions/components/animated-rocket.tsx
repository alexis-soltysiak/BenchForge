import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROCKET_LAUNCH_CSS } from "../constants";

export function AnimatedRocket({ className }: { className?: string }) {
  const [key, setKey] = useState(0);
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = 4000 + Math.random() * 8000;
      timeout = setTimeout(() => {
        setFiring(true);
        setKey((k) => k + 1);
        setTimeout(() => {
          setFiring(false);
          schedule();
        }, 2000);
      }, delay);
    }

    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <style>{ROCKET_LAUNCH_CSS}</style>
      <Rocket key={key} className={cn(className, firing && "rocket-firing")} />
    </>
  );
}
