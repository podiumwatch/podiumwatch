import { supabaseAdmin } from "./supabase-admin.mjs";

function getBearerToken(request) {
  const authorization =
    request.headers?.authorization ||
    request.headers?.Authorization ||
    "";

  const match = String(authorization).match(
    /^Bearer\s+(.+)$/i
  );

  return match?.[1]?.trim() || "";
}

export async function requireTeamUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error(
      "Team account sign in required."
    );

    error.status = 401;
    throw error;
  }

  const {
    data,
    error
  } = await supabaseAdmin.auth.getUser(
    accessToken
  );

  if (error || !data.user) {
    const authError = new Error(
      "Your team account session is no longer valid."
    );

    authError.status = 401;
    throw authError;
  }

  if (
    !data.user.email_confirmed_at &&
    !data.user.confirmed_at
  ) {
    const confirmationError =
      new Error(
        "Confirm your email before managing a team."
      );

    confirmationError.status = 403;
    throw confirmationError;
  }

  return data.user;
}

export function teamApiError(
  response,
  error,
  fallbackMessage
) {
  const status =
    Number(error?.status) || 500;

  if (status >= 500) {
    console.error(
      fallbackMessage,
      error
    );
  }

  return response.status(status).json({
    error:
      status < 500
        ? error.message
        : fallbackMessage
  });
}