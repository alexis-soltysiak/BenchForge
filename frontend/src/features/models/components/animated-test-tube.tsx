import { useEffect, useState } from "react";
import { TestTube2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEST_TUBE_CSS } from "../constants";

export function AnimatedTestTube({ className }: { className?: string }) {
  const [key, setKey] = useState(0);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = 3000 + Math.random() * 9000;
      timeout = setTimeout(() => {
        setShaking(true);
        setKey((k) => k + 1);
        setTimeout(() => {
          setShaking(false);
          schedule();
        }, 700);
      }, delay);
    }

    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <style>{TEST_TUBE_CSS}</style>
      <TestTube2 key={key} className={cn(className, shaking && "test-tube-shaking")} />
    </>
  );
}
