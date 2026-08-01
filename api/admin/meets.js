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

function cleanBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  const cleaned = cleanText(value).toLowerCase();

  return [
    "true",
    "1",
    "yes",
    "y",
    "on"
  ].includes(cleaned);
}

function parseBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  return request.body || {};
}

function cleanMeetIds(value) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Select at least one meet."
    );
  }

  const ids = [
    ...new Set(
      value
        .map((id) => cleanText(id))
        .filter(Boolean)
    )
  ];

  if (ids.length === 0) {
    throw new Error(
      "Select at least one meet."
    );
  }

  if (ids.length > 500) {
    throw new Error(
      "No more than 500 meets can be changed at once."
    );
  }

  return ids;
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
    : new Date(
        meetDate + "T12:00:00"
      ).getFullYear();

  if (!Number.isInteger(year)) {
    throw new Error(
      "Meet year must be a valid number."
    );
  }

  return {
    name,
    slug,
    year,
    sport,
    meet_date: meetDate,
    start_time: cleanNullableText(
      body.start_time
    ),
    end_date: cleanNullableText(
      body.end_date
    ),
    venue_name: cleanNullableText(
      body.venue_name
    ),
    address: cleanNullableText(
      body.address
    ),
    city: cleanNullableText(
      body.city
    ),
    state: cleanNullableText(
      body.state
    ),
    zip_code: cleanNullableText(
      body.zip_code
    ),
    google_maps_url: cleanNullableText(
      body.google_maps_url
    ),
    meet_type: cleanNullableText(
      body.meet_type
    ),
    division: cleanNullableText(
      body.division
    ),
    host_school: cleanNullableText(
      body.host_school
    ),
    description: cleanNullableText(
      body.description
    ),
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
    teams_text: cleanNullableText(
      body.teams_text
    ),
    results_url: cleanNullableText(
      body.results_url
    ),
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
    logo_url: cleanNullableText(
      body.logo_url
    ),
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
    featured: cleanBoolean(
      body.featured
    ),
    published: cleanBoolean(
      body.published
    ),
    updated_at: new Date().toISOString()
  };
}

async function createSingleMeet(body) {
  const meetRecord = buildMeetRecord(body);

  const {
    data: existingMeet,
    error: existingError
  } = await supabaseAdmin
    .from("meets")
    .select("id")
    .eq("slug", meetRecord.slug)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingMeet) {
    const duplicateError = new Error(
      "A meet already uses that page slug."
    );

    duplicateError.status = 409;
    throw duplicateError;
  }

  const {
    data: meet,
    error
  } = await supabaseAdmin
    .from("meets")
    .insert(meetRecord)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return meet;
}

async function createBulkMeets(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error(
      "The bulk import does not contain any meets."
    );

    error.status = 400;
    throw error;
  }

  if (rows.length > 500) {
    const error = new Error(
      "A bulk import can contain no more than 500 meets."
    );

    error.status = 400;
    throw error;
  }

  const validRows = [];
  const errors = [];
  const seenSlugs = new Map();

  rows.forEach((row, index) => {
    const csvRow = index + 2;

    try {
      const record = buildMeetRecord(row);

      if (seenSlugs.has(record.slug)) {
        errors.push({
          row: csvRow,
          name: record.name,
          error:
            "This page slug appears more than once in the file."
        });

        return;
      }

      seenSlugs.set(record.slug, csvRow);

      validRows.push({
        row: csvRow,
        record
      });
    } catch (error) {
      errors.push({
        row: csvRow,
        name: cleanText(row?.name),
        error: error.message
      });
    }
  });

  if (validRows.length === 0) {
    return {
      created: [],
      errors
    };
  }

  const slugs = validRows.map(
    (item) => item.record.slug
  );

  const {
    data: existingMeets,
    error: existingError
  } = await supabaseAdmin
    .from("meets")
    .select("slug")
    .in("slug", slugs);

  if (existingError) {
    throw existingError;
  }

  const existingSlugs = new Set(
    (existingMeets || []).map(
      (meet) => meet.slug
    )
  );

  const recordsToInsert = [];

  validRows.forEach((item) => {
    if (existingSlugs.has(item.record.slug)) {
      errors.push({
        row: item.row,
        name: item.record.name,
        error:
          "A meet already uses this page slug."
      });

      return;
    }

    recordsToInsert.push(item.record);
  });

  if (recordsToInsert.length === 0) {
    return {
      created: [],
      errors
    };
  }

  const {
    data: created,
    error: insertError
  } = await supabaseAdmin
    .from("meets")
    .insert(recordsToInsert)
    .select("*");

  if (insertError) {
    throw insertError;
  }

  return {
    created: created || [],
    errors
  };
}

export default async function handler(
  request,
  response
) {
  response.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Admin sign in required."
    });
  }

  if (request.method === "GET") {
    try {
      const {
        data: meets,
        error
      } = await supabaseAdmin
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
      console.error(
        "Admin meet list error:",
        error
      );

      return response.status(500).json({
        error:
          "Unable to load the meet list."
      });
    }
  }

  if (request.method === "POST") {
    try {
      const body = parseBody(request);

      if (Array.isArray(body.meets)) {
        const result = await createBulkMeets(
          body.meets
        );

        return response.status(200).json({
          created: result.created,
          errors: result.errors,
          created_count:
            result.created.length,
          error_count:
            result.errors.length
        });
      }

      const meet = await createSingleMeet(
        body
      );

      return response.status(201).json({
        meet
      });
    } catch (error) {
      console.error(
        "Admin create meet error:",
        error
      );

      const status =
        error.status ||
        (
          error.message?.includes(
            "required"
          ) ||
          error.message?.includes(
            "valid number"
          )
            ? 400
            : 500
        );

      return response.status(status).json({
        error:
          status < 500
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

      const meetRecord =
        buildMeetRecord(body);

      const {
        data: currentMeet,
        error: currentError
      } = await supabaseAdmin
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

      const {
        data: duplicateMeet,
        error: duplicateError
      } = await supabaseAdmin
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
          error:
            "Another meet already uses that page slug."
        });
      }

      const {
        data: meet,
        error
      } = await supabaseAdmin
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
      console.error(
        "Admin update meet error:",
        error
      );

      const status =
        error.message?.includes(
          "required"
        ) ||
        error.message?.includes(
          "valid number"
        )
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

  if (request.method === "PATCH") {
    try {
      const body = parseBody(request);
      const ids = cleanMeetIds(body.ids);
      const action = cleanText(
        body.action
      ).toLowerCase();

      const allowedActions = new Set([
        "publish",
        "draft",
        "feature",
        "unfeature"
      ]);

      if (!allowedActions.has(action)) {
        return response.status(400).json({
          error: "Choose a valid bulk action."
        });
      }

      const updates = {
        updated_at: new Date().toISOString()
      };

      if (action === "publish") {
        updates.published = true;
      }

      if (action === "draft") {
        updates.published = false;
      }

      if (action === "feature") {
        updates.featured = true;
      }

      if (action === "unfeature") {
        updates.featured = false;
      }

      const {
        data: updatedMeets,
        error
      } = await supabaseAdmin
        .from("meets")
        .update(updates)
        .in("id", ids)
        .select("*");

      if (error) {
        throw error;
      }

      return response.status(200).json({
        action,
        updated_count:
          updatedMeets?.length || 0,
        meets: updatedMeets || []
      });
    } catch (error) {
      console.error(
        "Admin bulk meet action error:",
        error
      );

      const status =
        error.message?.includes(
          "Select at least"
        ) ||
        error.message?.includes(
          "500 meets"
        )
          ? 400
          : 500;

      return response.status(status).json({
        error:
          status === 400
            ? error.message
            : "Unable to update the selected meets."
      });
    }
  }

  if (request.method === "DELETE") {
    try {
      const body = parseBody(request);
      const id = cleanText(body.id);
      const confirmName = cleanText(
        body.confirm_name
      );

      if (!id) {
        return response.status(400).json({
          error: "Meet ID is required."
        });
      }

      const {
        data: currentMeet,
        error: currentError
      } = await supabaseAdmin
        .from("meets")
        .select("id, name")
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

      if (confirmName !== currentMeet.name) {
        return response.status(400).json({
          error:
            "The confirmation name does not match the meet name."
        });
      }

      const {
        data: deletedMeet,
        error: deleteError
      } = await supabaseAdmin
        .from("meets")
        .delete()
        .eq("id", id)
        .select("id, name, slug")
        .single();

      if (deleteError) {
        throw deleteError;
      }

      return response.status(200).json({
        deleted: true,
        meet: deletedMeet
      });
    } catch (error) {
      console.error(
        "Admin delete meet error:",
        error
      );

      return response.status(500).json({
        error: "Unable to delete the meet."
      });
    }
  }

  response.setHeader(
    "Allow",
    "GET, POST, PUT, PATCH, DELETE"
  );

  return response.status(405).json({
    error: "Method not allowed."
  });
}