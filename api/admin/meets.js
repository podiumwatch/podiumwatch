import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function cleanSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  return request.body || {};
}

function buildMeetRecord(body) {
  const name = cleanText(body.name);
  const slug = cleanSlug(body.slug || body.name);
  const sport = cleanText(body.sport);
  const meetDate = cleanText(body.meet_date);

  if (!name) {
    throw new Error("Meet name is required.");
  }

  if (!slug) {
    throw new Error("Meet slug is required.");
  }

  if (!sport) {
    throw new Error("Sport is required.");
  }

  if (!meetDate) {
    throw new Error("Meet date is required.");
  }

  const suppliedYear = cleanText(body.year);

  const year = suppliedYear
    ? Number(suppliedYear)
    : new Date(meetDate + "T12:00:00").getFullYear();

  if (!Number.isInteger(year)) {
    throw new Error("Meet year must be a valid number.");
  }

  return {
    name,
    slug,
    year,
    sport,
    meet_date: meetDate,
    start_time: cleanNullableText(body.start_time),
    end_date: cleanNullableText(body.end_date),
    venue_name: cleanNullableText(body.venue_name),
    address: cleanNullableText(body.address),
    city: cleanNullableText(body.city),
    state: cleanNullableText(body.state),
    zip_code: cleanNullableText(body.zip_code),
    google_maps_url: cleanNullableText(
      body.google_maps_url
    ),
    meet_type: cleanNullableText(body.meet_type),
    division: cleanNullableText(body.division),
    host_school: cleanNullableText(body.host_school),
    description: cleanNullableText(body.description),
    schedule_text: cleanNullableText(
      body.schedule_text
    ),
    admission_text: cleanNullableText(
      body.admission_text
    ),
    parking_text: cleanNullableText(
      body.parking_text
    ),
    bus_information: cleanNullableText(
      body.bus_information
    ),
    awards_text: cleanNullableText(
      body.awards_text
    ),
    course_description: cleanNullableText(
      body.course_description
    ),
    teams_text: cleanNullableText(body.teams_text),
    results_url: cleanNullableText(body.results_url),
    athleticnet_url: cleanNullableText(
      body.athleticnet_url
    ),
    milesplit_url: cleanNullableText(
      body.milesplit_url
    ),
    registration_url: cleanNullableText(
      body.registration_url
    ),
    official_website_url: cleanNullableText(
      body.official_website_url
    ),
    course_map_url: cleanNullableText(
      body.course_map_url
    ),
    parking_map_url: cleanNullableText(
      body.parking_map_url
    ),
    schedule_pdf_url: cleanNullableText(
      body.schedule_pdf_url
    ),
    logo_url: cleanNullableText(body.logo_url),
    banner_image_url: cleanNullableText(
      body.banner_image_url
    ),
    preview_article_url: cleanNullableText(
      body.preview_article_url
    ),
    recap_article_url: cleanNullableText(
      body.recap_article_url
    ),
    instagram_url: cleanNullableText(
      body.instagram_url
    ),
    featured: body.featured === true,
    published: body.published === true,
    updated_at: new Date().toISOString()
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Admin sign in required."
    });
  }

  if (request.method === "GET") {
    try {
      const { data: meets, error } = await supabaseAdmin
        .from("meets")
        .select("*")
        .order("meet_date", {
          ascending: true
        })
        .order("name", {
          ascending: true
        });

      if (error) {
        throw error;
      }

      return response.status(200).json({
        meets: meets ?? []
      });
    } catch (error) {
      console.error("Admin meet list error:", error);

      return response.status(500).json({
        error: "Unable to load the meet list."
      });
    }
  }

  if (request.method === "POST") {
    try {
      const body = parseBody(request);
      const meetRecord = buildMeetRecord(body);

      const { data: existingMeet, error: existingError } =
        await supabaseAdmin
          .from("meets")
          .select("id")
          .eq("slug", meetRecord.slug)
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingMeet) {
        return response.status(409).json({
          error: "A meet already uses that page slug."
        });
      }

      const { data: meet, error } = await supabaseAdmin
        .from("meets")
        .insert(meetRecord)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return response.status(201).json({
        meet
      });
    } catch (error) {
      console.error("Admin create meet error:", error);

      const status =
        error.message?.includes("required") ||
        error.message?.includes("valid number")
          ? 400
          : 500;

      return response.status(status).json({
        error:
          status === 400
            ? error.message
            : "Unable to create the meet."
      });
    }
  }

  if (request.method === "PUT") {
    try {
      const body = parseBody(request);
      const id = cleanText(body.id);

      if (!id) {
        return response.status(400).json({
          error: "Meet ID is required."
        });
      }

      const meetRecord = buildMeetRecord(body);

      const { data: currentMeet, error: currentError } =
        await supabaseAdmin
          .from("meets")
          .select("id")
          .eq("id", id)
          .maybeSingle();

      if (currentError) {
        throw currentError;
      }

      if (!currentMeet) {
        return response.status(404).json({
          error: "Meet not found."
        });
      }

      const { data: duplicateMeet, error: duplicateError } =
        await supabaseAdmin
          .from("meets")
          .select("id")
          .eq("slug", meetRecord.slug)
          .neq("id", id)
          .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicateMeet) {
        return response.status(409).json({
          error: "Another meet already uses that page slug."
        });
      }

      const { data: meet, error } = await supabaseAdmin
        .from("meets")
        .update(meetRecord)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return response.status(200).json({
        meet
      });
    } catch (error) {
      console.error("Admin update meet error:", error);

      const status =
        error.message?.includes("required") ||
        error.message?.includes("valid number")
          ? 400
          : 500;

      return response.status(status).json({
        error:
          status === 400
            ? error.message
            : "Unable to update the meet."
      });
    }
  }

  response.setHeader("Allow", "GET, POST, PUT");

  return response.status(405).json({
    error: "Method not allowed."
  });
}