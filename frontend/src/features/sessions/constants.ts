import type { SessionFormState } from "./types";

export const ROCKET_LAUNCH_CSS = `
@keyframes rocket-launch {
  0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
  12%  { transform: translate(-3px, 3px) rotate(-8deg); opacity: 1; }
  40%  { transform: translate(18px, -18px) rotate(25deg); opacity: 0; }
  41%  { transform: translate(0,0) rotate(0deg); opacity: 0; }
  88%  { transform: translate(0,0) rotate(0deg); opacity: 0; }
  100% { transform: translate(0,0) rotate(0deg); opacity: 1; }
}
.rocket-firing {
  animation: rocket-launch 4s cubic-bezier(0.4,0,0.2,1) forwards;
}
`;

export const emptyForm: SessionFormState = {
  name: "",
  description: "",
  status: "draft",
};

export const DIFFICULTY_STYLES: Record<number, string> = {
  1: "bg-emerald-500 text-white",
  2: "bg-cyan-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-orange-500 text-white",
  5: "bg-red-500 text-white",
};
