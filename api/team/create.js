import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  writeTeamChange
} from "../../lib/team_audit.mjs";

function cleanText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanKeyPart(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function buildSchoolKey({
  schoolName,
  city,
  programLevel
}) {
  return [
    cleanKeyPart(schoolName),
    cleanKeyPart(city),
    cleanKeyPart(programLevel)
  ]
    .filter(Boolean)
    .join("|");
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

function cleanEmail(value) {
  const cleaned = cleanText(value);

  if (
    cleaned &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cleaned
    )
  ) {
    const error = new Error(
      "Enter a valid email address."
    );

    error.status = 400;
    throw error;
  }

  return cleaned || null;
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
      : "https://" + cleaned;

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
      label + " must be a valid website address."
    );

    error.status = 400;
    throw error;
  }
}

async function createUniqueSlug(
  schoolName,
  city
) {
  const base =
    slugify(
      [
        schoolName,
        city
      ]
        .filter(Boolean)
        .join(" ")
    ) || "team";

  let slug = base;
  let suffix = 2;

  while (true) {
    const {
      data,
      error
    } = await supabaseAdmin
      .from("team_pages")
      .select("id")
      .ilike("slug", slug)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return slug;
    }

    slug =
      base +
      "-" +
      suffix;

    suffix += 1;
  }
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
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  let createdTeamId = "";

  try {
    const user =
      await requireTeamUser(request);

    const body = parseBody(request);

    const schoolName = cleanText(
      body.school_name
    );

    const city = cleanText(
      body.city
    );

    const state =
      cleanText(body.state) ||
      "Ohio";

    if (!schoolName) {
      const error = new Error(
        "School name is required."
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

    const {
      data: duplicateTeams,
      error: duplicateError
    } = await supabaseAdmin
      .from("team_pages")
      .select("id")
      .ilike(
        "school_name",
        schoolName
      )
      .ilike("city", city)
      .limit(5);

    if (duplicateError) {
      throw duplicateError;
    }

    if (
      Array.isArray(duplicateTeams) &&
      duplicateTeams.length > 0
    ) {
      const error = new Error(
        "A team page for this school and city already exists. Search for it and request access instead."
      );

      error.status = 409;
      throw error;
    }

    const allowedLevels =
      new Set([
        "high_school",
        "middle_school",
        "club"
      ]);

    const allowedScopes =
      new Set([
        "combined",
        "boys",
        "girls"
      ]);

    const programLevel =
      allowedLevels.has(
        body.program_level
      )
        ? body.program_level
        : "high_school";

    const programScope =
      allowedScopes.has(
        body.program_scope
      )
        ? body.program_scope
        : "combined";

    const schoolKey =
      buildSchoolKey({
        schoolName,
        city,
        programLevel
      });

    const instagramUrl =
      cleanUrl(
        body.instagram_url,
        "Instagram"
      );

    const xUrl =
      cleanUrl(
        body.x_url,
        "X"
      );

    const facebookUrl =
      cleanUrl(
        body.facebook_url,
        "Facebook"
      );

    const tiktokUrl =
      cleanUrl(
        body.tiktok_url,
        "TikTok"
      );

    const youtubeUrl =
      cleanUrl(
        body.youtube_url,
        "YouTube"
      );

    const websiteUrl =
      cleanUrl(
        body.website_url,
        "Team website"
      );

    const athleticsUrl =
      cleanUrl(
        body.athletics_url,
        "Athletics website"
      );

    const linksPageUrl =
      cleanUrl(
        body.links_page_url,
        "Links page"
      );

    const recruitingQuestionnaireUrl =
      cleanUrl(
        body.recruiting_questionnaire_url,
        "Recruiting questionnaire"
      );

    const teamStoreUrl =
      cleanUrl(
        body.team_store_url,
        "Team store"
      );

    const fundraiserUrl =
      cleanUrl(
        body.fundraiser_url,
        "Fundraiser"
      );

    const slug =
      await createUniqueSlug(
        schoolName,
        city
      );

    const teamRecord = {
      school_name: schoolName,
      slug,
      school_key: schoolKey,
      profile_origin:
        "coach_created",
      claimed_at:
        new Date().toISOString(),
      mascot:
        cleanNullableText(
          body.mascot
        ),
      city,
      state,
      zip_code:
        cleanNullableText(
          body.zip_code
        ),
      conference:
        cleanNullableText(
          body.conference
        ),
      region:
        cleanNullableText(
          body.region
        ),
      program_level:
        programLevel,
      program_scope:
        programScope,
      head_coach:
        cleanNullableText(
          body.head_coach
        ),
      public_contact_email:
        cleanEmail(
          body.public_contact_email
        ),
      recruiting_contact_email:
        cleanEmail(
          body.recruiting_contact_email
        ),
      website_url: websiteUrl,
      athletics_url: athleticsUrl,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      youtube_url: youtubeUrl,
      x_url: xUrl,
      links_page_url: linksPageUrl,
      recruiting_questionnaire_url:
        recruitingQuestionnaireUrl,
      team_store_url: teamStoreUrl,
      fundraiser_url: fundraiserUrl,
      social_links_verified: false,
      published: false,
      verified: false,
      suspended: false,
      created_by: user.id
    };

    const {
      data: team,
      error: teamError
    } = await supabaseAdmin
      .from("team_pages")
      .insert(teamRecord)
      .select("*")
      .single();

    if (teamError) {
      throw teamError;
    }

    createdTeamId = team.id;

    const displayName =
      cleanText(
        user.user_metadata
          ?.display_name
      ) || null;

    const {
      error: memberError
    } = await supabaseAdmin
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: "owner",
        status: "active",
        display_name:
          displayName
      });

    if (memberError) {
      throw memberError;
    }

    const socialLinks = [
      [
        "Instagram",
        "Instagram",
        instagramUrl
      ],
      [
        "X",
        "X",
        xUrl
      ],
      [
        "Facebook",
        "Facebook",
        facebookUrl
      ],
      [
        "TikTok",
        "TikTok",
        tiktokUrl
      ],
      [
        "YouTube",
        "YouTube",
        youtubeUrl
      ],
      [
        "Linktree",
        "All Team Links",
        linksPageUrl
      ]
    ]
      .filter(
        ([, , url]) =>
          Boolean(url)
      )
      .map(
        (
          [
            platform,
            label,
            url
          ],
          index
        ) => ({
          team_id: team.id,
          platform,
          label,
          url,
          sport_scope: "All",
          program_scope:
            programScope,
          verified: false,
          published: true,
          sort_order: index
        })
      );

    if (socialLinks.length > 0) {
      const {
        error: socialError
      } = await supabaseAdmin
        .from("team_social_links")
        .insert(socialLinks);

      if (socialError) {
        throw socialError;
      }
    }

    await writeTeamChange({
      teamId: team.id,
      actorType: "team_user",
      actorId: user.id,
      action: "create_team_profile",
      summary:
        "The team profile was created.",
      changedFields: [
        "team_pages",
        "team_members",
        "team_social_links"
      ],
      afterData: {
        school_name: team.school_name,
        city: team.city,
        slug: team.slug,
        profile_origin:
          team.profile_origin
      }
    });

    return response.status(201).json({
      team
    });
  } catch (error) {
    if (
      error?.code === "23505" &&
      !createdTeamId
    ) {
      error.status = 409;
      error.message =
        "A team page for this school already exists. Search for it and request access instead.";
    }

    if (createdTeamId) {
      await supabaseAdmin
        .from("team_pages")
        .delete()
        .eq("id", createdTeamId);
    }

    return teamApiError(
      response,
      error,
      "Unable to create the team page."
    );
  }
}