const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

type RequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Network request failed.";
    throw new ApiError(
      `Unable to reach the API at ${API_URL}. Check that the backend is running and CORS allows the frontend origin. (${message})`,
      0,
    );
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new ApiError(
      errorBody?.detail ?? "Unexpected API error.",
      response.status,
    );
  }

  return (await response.json()) as T;
}
