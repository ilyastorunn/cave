export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const bad = (error: string, status = 400) => Response.json({ error }, { status });

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads a JSON object body, or null if the body is not a JSON object. */
export async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await request.json();
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
