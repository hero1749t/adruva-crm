import { supabase } from "@/integrations/supabase/client";

const isMissingFunctionError = (error: unknown) => {
  const message = String((error as { message?: string } | undefined)?.message || "");
  return message.includes("404") || message.includes("NOT_FOUND") || message.includes("FunctionsHttpError");
};

export async function invokeSupabaseFunction<TBody extends Record<string, unknown>>(
  functionName: string,
  body?: TBody
) {
  try {
    const response = await supabase.functions.invoke(functionName, body ? { body } : undefined);
    if (response.error) {
      throw response.error;
    }
    return { data: response.data, missing: false };
  } catch (error) {
    if (isMissingFunctionError(error)) {
      return { data: null, missing: true };
    }
    throw error;
  }
}
