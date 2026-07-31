import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

function cleanText(value, maximumLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidOptionalUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
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
      This is a hidden form field used to catch simple bots.
      Real users should never fill it in.
    */
    if (cleanText(body.website, 200)) {
      return response.status(200).json({
        success: true,
        message: "Your nomination has been submitted."
      });
    }

    const athleteName = cleanText(
      body.athlete_name,
      120
    );

    const school = cleanText(
      body.school,
      120
    );

    const grade = cleanText(
      body.grade,
      30
    );

    const gender = cleanText(
      body.gender,
      30
    );

    const eventName = cleanText(
      body.event_name,
      120
    );

    const performance = cleanText(
      body.performance,
      120
    );

    const meetName = cleanText(
      body.meet_name,
      160
    );

    const performanceDate = cleanText(
      body.performance_date,
      20
    );

    const reason = cleanText(
      body.reason,
      2000
    );

    const resultUrl = cleanText(
      body.result_url,
      500
    );

    const photoUrl = cleanText(
      body.photo_url,
      500
    );

    const nominatorName = cleanText(
      body.nominator_name,
      120
    );

    const nominatorEmail = cleanText(
      body.nominator_email,
      254
    ).toLowerCase();

    const requiredValues = [
      athleteName,
      school,
      grade,
      gender,
      eventName,
      performance,
      meetName,
      performanceDate,
      reason,
      nominatorName,
      nominatorEmail
    ];

    if (
      requiredValues.some(
        (value) => !value
      )
    ) {
      return response.status(400).json({
        error:
          "Please complete every required field."
      });
    }

    if (!isValidEmail(nominatorEmail)) {
      return response.status(400).json({
        error:
          "Please enter a valid email address."
      });
    }

    if (!isValidOptionalUrl(resultUrl)) {
      return response.status(400).json({
        error:
          "The result link must be a valid web address."
      });
    }

    if (!isValidOptionalUrl(photoUrl)) {
      return response.status(400).json({
        error:
          "The photo link must be a valid web address."
      });
    }

    const parsedPerformanceDate = new Date(
      `${performanceDate}T12:00:00`
    );

    if (
      Number.isNaN(
        parsedPerformanceDate.getTime()
      )
    ) {
      return response.status(400).json({
        error:
          "Please enter a valid performance date."
      });
    }

    const currentTime =
      new Date().toISOString();

    const {
      data: week,
      error: weekError
    } = await supabaseAdmin
      .from("aotw_weeks")
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
          "There is not an active nomination period."
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
          "Nominations are currently closed."
      });
    }

    const {
      error: insertError
    } = await supabaseAdmin
      .from("aotw_nominations")
      .insert({
        week_id: week.id,
        athlete_name: athleteName,
        school,
        grade,
        gender,
        event_name: eventName,
        performance,
        meet_name: meetName,
        performance_date: performanceDate,
        reason,
        result_url: resultUrl || null,
        photo_url: photoUrl || null,
        nominator_name: nominatorName,
        nominator_email: nominatorEmail
      });

    if (insertError) {
      throw insertError;
    }

    return response.status(201).json({
      success: true,
      message:
        "Your nomination has been submitted. Thank you for supporting Ohio high school athletes."
    });
  } catch (error) {
    console.error(
      "Athlete of the Week nomination error:",
      error
    );

    return response.status(500).json({
      error:
        "Unable to submit the nomination right now."
    });
  }
}