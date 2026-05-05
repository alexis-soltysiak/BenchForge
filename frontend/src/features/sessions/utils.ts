import type { Session, SessionFormState, SessionPayload } from "./types";

export function toFormState(session: Session): SessionFormState {
  return {
    name: session.name,
    description: session.description ?? "",
    status: session.status,
  };
}

export function toPayload(state: SessionFormState): SessionPayload {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    status: state.status,
    rubric_version: "mvp-v1",
  };
}

export function formatDate(value: string): string {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}

export function matchesSearch(session: Session, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    session.name,
    session.description ?? "",
    session.status,
    session.rubric_version,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export function matchesArchiveState(session: Session, showArchived: boolean): boolean {
  return showArchived ? session.status === "archived" : session.status !== "archived";
}
