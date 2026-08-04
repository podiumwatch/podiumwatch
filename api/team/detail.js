import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  isAdminRequest
} from "../../lib/admin_auth.mjs";
import {
  calculateTeamCompletion,
  getChangedFields,
  pickTeamFields,
  writeTeamChange
} from "../../lib/team_audit.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function cleanBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  return ["true", "1", "yes", "on"].includes(
    cleanText(value).toLowerCase()
  );
}

function cleanSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanEmail(value, label) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cleaned
    )
  ) {
    const error = new Error(
      `${label} must be a valid email address.`
    );

    error.status = 400;
    throw error;
  }

  return cleaned;
}

function cleanUrl(value, label) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const prepared =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(
      cleaned
    )
      ? cleaned
      : `https://${cleaned}`;

  try {
    const url = new URL(prepared);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new Error();
    }

    return url.href;
  } catch {
    const error = new Error(
      `${label} must be a valid website address.`
    );

    error.status = 400;
    throw error;
  }
}

function cleanColor(value, fallback) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return fallback;
  }

  if (!/^#[0-9a-f]{6}$/i.test(cleaned)) {
    const error = new Error(
      "Team colors must use a six digit color code."
    );

    error.status = 400;
    throw error;
  }

  return cleaned.toLowerCase();
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error(
        "The submitted team data is invalid."
      );

      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

async function findTeam(body) {
  const teamId = cleanText(body.team_id);
  const slug = cleanSlug(body.slug);

  let query = supabaseAdmin
    .from("team_pages")
    .select("*");

  if (teamId) {
    query = query.eq("id", teamId);
  } else if (slug) {
    query = query.ilike("slug", slug);
  } else {
    const error = new Error(
      "Choose a team page."
    );

    error.status = 400;
    throw error;
  }

  const {
    data: team,
    error
  } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!team) {
    const error = new Error(
      "Team page not found."
    );

    error.status = 404;
    throw error;
  }

  return team;
}

async function requireMembership(
  userId,
  teamId
) {
  const {
    data: membership,
    error
  } = await supabaseAdmin
    .from("team_members")
    .select(
      "id, team_id, user_id, role, status, display_name"
    )
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!membership) {
    const permissionError = new Error(
      "You do not have permission to manage this team."
    );

    permissionError.status = 403;
    throw permissionError;
  }

  return membership;
}

async function getSocialLinks(teamId) {
  const {
    data,
    error
  } = await supabaseAdmin
    .from("team_social_links")
    .select("*")
    .eq("team_id", teamId)
    .order("sort_order", {
      ascending: true
    })
    .order("platform", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  return data || [];
}

async function getTeamSchedule(teamId) {
  const {
    data: connections,
    error: connectionError
  } = await supabaseAdmin
    .from("team_meet_connections")
    .select("*")
    .eq("team_id", teamId)
    .order("sort_order", {
      ascending: true
    })
    .order("created_at", {
      ascending: true
    });

  if (connectionError) {
    throw connectionError;
  }

  const rows = connections || [];
  const meetIds = [
    ...new Set(
      rows
        .map((connection) => connection.meet_id)
        .filter(Boolean)
    )
  ];

  if (meetIds.length === 0) {
    return [];
  }

  const {
    data: meets,
    error: meetError
  } = await supabaseAdmin
    .from("meets")
    .select(
      `
        id,
        name,
        slug,
        sport,
        meet_date,
        start_time,
        end_date,
        venue_name,
        address,
        city,
        state,
        zip_code,
        host_school,
        meet_type,
        division,
        results_url,
        athleticnet_url,
        milesplit_url,
        registration_url,
        official_website_url,
        google_maps_url,
        published,
        featured
      `
    )
    .in("id", meetIds);

  if (meetError) {
    throw meetError;
  }

  const meetMap = new Map(
    (meets || []).map(
      (meet) => [meet.id, meet]
    )
  );

  return rows
    .map((connection) => ({
      ...connection,
      meet:
        meetMap.get(connection.meet_id) ||
        null
    }))
    .filter((connection) => connection.meet);
}

function buildTeamUpdates(body) {
  const schoolName = cleanText(
    body.school_name
  );

  const slug = cleanSlug(
    body.slug || body.school_name
  );

  const city = cleanText(body.city);

  if (!schoolName) {
    const error = new Error(
      "School name is required."
    );

    error.status = 400;
    throw error;
  }

  if (!slug) {
    const error = new Error(
      "Page address is required."
    );

    error.status = 400;
    throw error;
  }

  if (!city) {
    const error = new Error(
      "City is required."
    );

    error.status = 400;
    throw error;
  }

  const allowedLevels = new Set([
    "high_school",
    "middle_school",
    "club"
  ]);

  const allowedScopes = new Set([
    "combined",
    "boys",
    "girls"
  ]);

  const allowedHeadCoachSetups = new Set([
    "combined",
    "separate",
    "boys_only",
    "girls_only"
  ]);

  return {
    school_name: schoolName,
    slug,
    mascot:
      cleanNullableText(body.mascot),
    city,
    state:
      cleanText(body.state) || "Ohio",
    zip_code:
      cleanNullableText(body.zip_code),
    conference:
      cleanNullableText(body.conference),
    region:
      cleanNullableText(body.region),
    program_level:
      allowedLevels.has(
        body.program_level
      )
        ? body.program_level
        : "high_school",
    program_scope:
      allowedScopes.has(
        body.program_scope
      )
        ? body.program_scope
        : "combined",
    cross_country_boys_division:
      cleanNullableText(
        body.cross_country_boys_division
      ),
    cross_country_girls_division:
      cleanNullableText(
        body.cross_country_girls_division
      ),
    track_boys_division:
      cleanNullableText(
        body.track_boys_division
      ),
    track_girls_division:
      cleanNullableText(
        body.track_girls_division
      ),
    head_coach_setup:
      allowedHeadCoachSetups.has(
        body.head_coach_setup
      )
        ? body.head_coach_setup
        : "combined",

    head_coach:
      cleanNullableText(body.head_coach),

    head_boys_coach:
      cleanNullableText(
        body.head_boys_coach
      ),

    head_girls_coach:
      cleanNullableText(
        body.head_girls_coach
      ),

    assistant_coaches_text:
      cleanNullableText(
        body.assistant_coaches_text
      ),
    public_contact_email:
      cleanEmail(
        body.public_contact_email,
        "Public contact email"
      ),
    recruiting_contact_email:
      cleanEmail(
        body.recruiting_contact_email,
        "Recruiting contact email"
      ),
    description:
      cleanNullableText(body.description),
    history_text:
      cleanNullableText(body.history_text),
    traditions_text:
      cleanNullableText(
        body.traditions_text
      ),
    primary_color:
      cleanColor(
        body.primary_color,
        "#00bf63"
      ),
    secondary_color:
      cleanColor(
        body.secondary_color,
        "#111827"
      ),
    logo_url:
      cleanUrl(body.logo_url, "Logo"),
    banner_image_url:
      cleanUrl(
        body.banner_image_url,
        "Banner image"
      ),
    website_url:
      cleanUrl(
        body.website_url,
        "Team website"
      ),
    athletics_url:
      cleanUrl(
        body.athletics_url,
        "Athletics website"
      ),
    links_page_url:
      cleanUrl(
        body.links_page_url,
        "Links page"
      ),
    recruiting_questionnaire_url:
      cleanUrl(
        body.recruiting_questionnaire_url,
        "Recruiting questionnaire"
      ),
    team_store_url:
      cleanUrl(
        body.team_store_url,
        "Team store"
      ),
    fundraiser_url:
      cleanUrl(
        body.fundraiser_url,
        "Fundraiser"
      ),
    published:
      cleanBoolean(body.published)
  };
}

function buildSocialRecord(
  body,
  teamId
) {
  const platforms = new Set([
    "Instagram",
    "X",
    "Facebook",
    "TikTok",
    "YouTube",
    "Linktree",
    "Website",
    "Other"
  ]);

  const sportScopes = new Set([
    "All",
    "Cross Country",
    "Track and Field"
  ]);

  const programScopes = new Set([
    "combined",
    "boys",
    "girls"
  ]);

  const platform = cleanText(
    body.platform
  );

  if (!platforms.has(platform)) {
    const error = new Error(
      "Choose a valid social platform."
    );

    error.status = 400;
    throw error;
  }

  const url = cleanUrl(
    body.url,
    platform
  );

  if (!url) {
    const error = new Error(
      "Social account URL is required."
    );

    error.status = 400;
    throw error;
  }

  let sortOrder =
    Number(body.sort_order);

  if (!Number.isInteger(sortOrder)) {
    sortOrder = 0;
  }

  return {
    team_id: teamId,
    platform,
    label:
      cleanNullableText(body.label),
    url,
    sport_scope:
      sportScopes.has(
        body.sport_scope
      )
        ? body.sport_scope
        : "All",
    program_scope:
      programScopes.has(
        body.program_scope
      )
        ? body.program_scope
        : "combined",
    published:
      cleanBoolean(body.published),
    sort_order:
      Math.max(
        0,
        Math.min(999, sortOrder)
      )
  };
}

const TEAM_PROFILE_FIELDS = [
  "school_name",
  "slug",
  "mascot",
  "city",
  "state",
  "zip_code",
  "conference",
  "region",
  "program_level",
  "program_scope",
  "cross_country_boys_division",
  "cross_country_girls_division",
  "track_boys_division",
  "track_girls_division",
  "head_coach_setup",
  "head_coach",
  "head_boys_coach",
  "head_girls_coach",
  "assistant_coaches_text",
  "public_contact_email",
  "recruiting_contact_email",
  "description",
  "history_text",
  "traditions_text",
  "primary_color",
  "secondary_color",
  "logo_url",
  "banner_image_url",
  "website_url",
  "athletics_url",
  "links_page_url",
  "recruiting_questionnaire_url",
  "team_store_url",
  "fundraiser_url",
  "published"
];

function assertTeamEditable(team, adminMode) {
  if (adminMode) {
    return;
  }

  if (team.merged_into_team_id) {
    const error = new Error(
      "This duplicate profile has been merged into another team page."
    );
    error.status = 409;
    throw error;
  }

  if (team.archived_at) {
    const error = new Error(
      "This team profile is archived and cannot be edited."
    );
    error.status = 403;
    throw error;
  }

  if (team.suspended) {
    const error = new Error(
      "This team profile is suspended and cannot be edited."
    );
    error.status = 403;
    throw error;
  }

  if (team.editing_locked) {
    const error = new Error(
      team.editing_lock_reason ||
      "Podium Watch has temporarily locked editing for this team page."
    );
    error.status = 423;
    throw error;
  }
}

function getActor(adminMode, user) {
  return adminMode
    ? {
        actorType: "admin",
        actorId: "Podium Watch Admin"
      }
    : {
        actorType: "team_user",
        actorId: user?.id || "unknown"
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

  if (request.method !== "POST") {
    response.setHeader(
      "Allow",
      "POST"
    );

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const adminMode = isAdminRequest(request);
    const user = adminMode
      ? null
      : await requireTeamUser(request);
    const actor = getActor(adminMode, user);
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();

    if (action === "get") {
      const team = await findTeam(body);
      const membership = adminMode
        ? {
            role: "admin",
            status: "active",
            display_name: "Podium Watch Admin"
          }
        : await requireMembership(user.id, team.id);
      const [
        socialLinks,
        schedule
      ] = await Promise.all([
        getSocialLinks(team.id),
        getTeamSchedule(team.id)
      ]);

      return response.status(200).json({
        team: {
          ...team,
          completion_score: calculateTeamCompletion(team, socialLinks)
        },
        membership,
        social_links: socialLinks,
        schedule
      });
    }

    if (action === "save") {
      const teamId = cleanText(body.team_id);

      if (!teamId) {
        const error = new Error("Team ID is required.");
        error.status = 400;
        throw error;
      }

      if (!adminMode) {
        await requireMembership(user.id, teamId);
      }

      const before = await findTeam({ team_id: teamId });
      assertTeamEditable(before, adminMode);
      const updates = buildTeamUpdates(body);

      if (
        updates.published &&
        (before.suspended || before.archived_at || before.merged_into_team_id)
      ) {
        const error = new Error(
          "A suspended, archived, or merged profile cannot be published."
        );
        error.status = 409;
        throw error;
      }

      const { data: duplicateTeam, error: duplicateError } = await supabaseAdmin
        .from("team_pages")
        .select("id")
        .ilike("slug", updates.slug)
        .neq("id", teamId)
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicateTeam) {
        const error = new Error(
          "Another team already uses that page address."
        );
        error.status = 409;
        throw error;
      }

      const { data: team, error } = await supabaseAdmin
        .from("team_pages")
        .update(updates)
        .eq("id", teamId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const changedFields = getChangedFields(before, team, TEAM_PROFILE_FIELDS);

      if (changedFields.length > 0) {
        await writeTeamChange({
          teamId,
          ...actor,
          action: "save_team_profile",
          summary: adminMode
            ? "Podium Watch updated the team profile."
            : "A team manager updated the team profile.",
          changedFields,
          beforeData: pickTeamFields(before, changedFields),
          afterData: pickTeamFields(team, changedFields),
          metadata: {
            admin_mode: adminMode
          }
        });
      }

      return response.status(200).json({ team });
    }

    if (action === "save_social") {
      const teamId = cleanText(body.team_id);

      if (!teamId) {
        const error = new Error("Team ID is required.");
        error.status = 400;
        throw error;
      }

      if (!adminMode) {
        await requireMembership(user.id, teamId);
      }

      const team = await findTeam({ team_id: teamId });
      assertTeamEditable(team, adminMode);
      const socialId = cleanText(body.social_id);
      const record = buildSocialRecord(body, teamId);

      if (socialId) {
        const { data: existingLink, error: existingError } = await supabaseAdmin
          .from("team_social_links")
          .select("*")
          .eq("id", socialId)
          .eq("team_id", teamId)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (!existingLink) {
          const error = new Error("Social link not found.");
          error.status = 404;
          throw error;
        }

        const { data: socialLink, error } = await supabaseAdmin
          .from("team_social_links")
          .update(record)
          .eq("id", socialId)
          .eq("team_id", teamId)
          .select("*")
          .single();

        if (error?.code === "23505") {
          const duplicateError = new Error(
            "That social account is already listed."
          );
          duplicateError.status = 409;
          throw duplicateError;
        }

        if (error) {
          throw error;
        }

        await writeTeamChange({
          teamId,
          ...actor,
          action: "update_team_social_link",
          summary: `${socialLink.platform} account information was updated.`,
          changedFields: ["social_links"],
          beforeData: existingLink,
          afterData: socialLink,
          metadata: { social_id: socialId }
        });

        return response.status(200).json({ social_link: socialLink });
      }

      const { data: socialLink, error } = await supabaseAdmin
        .from("team_social_links")
        .insert({
          ...record,
          verified: false
        })
        .select("*")
        .single();

      if (error?.code === "23505") {
        const duplicateError = new Error(
          "That social account is already listed."
        );
        duplicateError.status = 409;
        throw duplicateError;
      }

      if (error) {
        throw error;
      }

      await writeTeamChange({
        teamId,
        ...actor,
        action: "add_team_social_link",
        summary: `${socialLink.platform} was added to the team profile.`,
        changedFields: ["social_links"],
        afterData: socialLink,
        metadata: { social_id: socialLink.id }
      });

      return response.status(201).json({ social_link: socialLink });
    }

    if (action === "delete_social") {
      const teamId = cleanText(body.team_id);
      const socialId = cleanText(body.social_id);

      if (!teamId || !socialId) {
        const error = new Error("Choose a social link.");
        error.status = 400;
        throw error;
      }

      if (!adminMode) {
        await requireMembership(user.id, teamId);
      }

      const team = await findTeam({ team_id: teamId });
      assertTeamEditable(team, adminMode);

      const { data: existingLink, error: lookupError } = await supabaseAdmin
        .from("team_social_links")
        .select("*")
        .eq("id", socialId)
        .eq("team_id", teamId)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (!existingLink) {
        const error = new Error("Social link not found.");
        error.status = 404;
        throw error;
      }

      const { data: deletedLink, error } = await supabaseAdmin
        .from("team_social_links")
        .delete()
        .eq("id", socialId)
        .eq("team_id", teamId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!deletedLink) {
        const error = new Error("Social link not found.");
        error.status = 404;
        throw error;
      }

      await writeTeamChange({
        teamId,
        ...actor,
        action: "delete_team_social_link",
        summary: `${existingLink.platform} was removed from the team profile.`,
        changedFields: ["social_links"],
        beforeData: existingLink,
        metadata: { social_id: socialId }
      });

      return response.status(200).json({ deleted: true });
    }

    return response.status(400).json({
      error: "Choose a valid team action."
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "Unable to manage the team page."
    );
  }
}
