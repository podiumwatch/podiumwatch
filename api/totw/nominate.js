import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

const ALLOWED_CATEGORIES = new Set([
  "boys",
  "girls"
]);

function cleanText(value, maximumLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function readBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  return request.body ?? {};
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function permissionWasGiven(value) {
  return (
    value === true ||
    value === "true" ||
    value === "on" ||
    value === "yes"
  );
}

function cleanOptionalUrl(value) {
  const cleanedValue = cleanText(value, 1000);

  if (!cleanedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(cleanedValue);

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function cleanOptionalDate(value) {
  const cleanedValue = cleanText(value, 20);

  if (!cleanedValue) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedValue)) {
    return null;
  }

  const date = new Date(
    `${cleanedValue}T00:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return cleanedValue;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = readBody(request);

    /*
      Hidden field used to catch simple automated submissions.
      Real users should leave this empty.
    */
    if (cleanText(body.website, 200)) {
      return response.status(201).json({
        success: true,
        message:
          "Your Team of the Week nomination has been submitted."
      });
    }

    const category = cleanText(
      body.category,
      20
    ).toLowerCase();

    const teamName = cleanText(
      body.team_name,
      150
    );

    const school = cleanText(
      body.school,
      150
    );

    const sport = cleanText(
      body.sport,
      100
    );

    const division = cleanText(
      body.division,
      50
    );

    const achievement = cleanText(
      body.achievement,
      500
    );

    const meetName = cleanText(
      body.meet_name,
      200
    );

    const performanceDate =
      cleanOptionalDate(body.performance_date);

    const reason = cleanText(
      body.reason,
      2500
    );

    const resultUrlInput = cleanText(
      body.result_url,
      1000
    );

    const photoUrlInput = cleanText(
      body.photo_url,
      1000
    );

    const resultUrl = cleanOptionalUrl(
      resultUrlInput
    );

    const photoUrl = cleanOptionalUrl(
      photoUrlInput
    );

    const nominatorName = cleanText(
      body.nominator_name,
      150
    );

    const nominatorEmail = cleanText(
      body.nominator_email,
      254
    ).toLowerCase();

    if (!ALLOWED_CATEGORIES.has(category)) {
      return response.status(400).json({
        error:
          "Please choose either the boys or girls category."
      });
    }

    if (!teamName) {
      return response.status(400).json({
        error: "Please enter the team name."
      });
    }

    if (!school) {
      return response.status(400).json({
        error: "Please enter the school."
      });
    }

    if (!sport) {
      return response.status(400).json({
        error: "Please enter the sport."
      });
    }

    if (!achievement) {
      return response.status(400).json({
        error:
          "Please describe the team performance or achievement."
      });
    }

    if (!reason) {
      return response.status(400).json({
        error:
          "Please explain why this team should be selected."
      });
    }

    if (!nominatorName) {
      return response.status(400).json({
        error: "Please enter your name."
      });
    }

    if (
      !nominatorEmail ||
      !emailIsValid(nominatorEmail)
    ) {
      return response.status(400).json({
        error:
          "Please enter a valid nominator email address."
      });
    }

    if (
      resultUrlInput &&
      !resultUrl
    ) {
      return response.status(400).json({
        error:
          "Please enter a valid result link beginning with http or https."
      });
    }

    if (
      photoUrlInput &&
      !photoUrl
    ) {
      return response.status(400).json({
        error:
          "Please enter a valid photo link beginning with http or https."
      });
    }

    if (
      cleanText(body.performance_date, 20) &&
      !performanceDate
    ) {
      return response.status(400).json({
        error:
          "Please enter a valid performance date."
      });
    }

    if (!permissionWasGiven(body.permission)) {
      return response.status(400).json({
        error:
          "You must confirm that the information may be reviewed and published by Podium Watch."
      });
    }

    const currentTime =
      new Date().toISOString();

    const {
      data: week,
      error: weekError
    } = await supabaseAdmin
      .from("totw_weeks")
      .select(`
        id,
        status,
        nomination_opens,
        nomination_closes
      `)
      .eq("status", "nominations_open")
      .lte("nomination_opens", currentTime)
      .gte("nomination_closes", currentTime)
      .order("nomination_opens", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (weekError) {
      throw weekError;
    }

    if (!week) {
      return response.status(400).json({
        error:
          "There is not an active Team of the Week nomination period."
      });
    }

    const currentDate = new Date();

    const nominationOpens = new Date(
      week.nomination_opens
    );

    const nominationCloses = new Date(
      week.nomination_closes
    );

    const nominationsAreOpen =
      week.status === "nominations_open" &&
      currentDate >= nominationOpens &&
      currentDate <= nominationCloses;

    if (!nominationsAreOpen) {
      return response.status(400).json({
        error:
          "Team of the Week nominations are currently closed."
      });
    }

    const {
      data: nomination,
      error: nominationError
    } = await supabaseAdmin
      .from("totw_nominations")
      .insert({
        week_id: week.id,
        category,
        team_name: teamName,
        school,
        sport,
        division: division || null,
        achievement,
        meet_name: meetName || null,
        performance_date: performanceDate,
        reason,
        result_url: resultUrl,
        photo_url: photoUrl,
        nominator_name: nominatorName,
        nominator_email: nominatorEmail
      })
      .select("id")
      .single();

    if (nominationError) {
      throw nominationError;
    }

    return response.status(201).json({
      success: true,
      nomination_id: nomination.id,
      message:
        "Your Team of the Week nomination has been submitted."
    });
  } catch (error) {
    console.error(
      "Team of the Week nomination error:",
      error
    );

    return response.status(500).json({
      error:
        "Unable to submit the Team of the Week nomination right now."
    });
  }
}