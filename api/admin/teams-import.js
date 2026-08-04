import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  isAdminRequest
} from "../../lib/admin_auth.mjs";

const MAX_ROWS = 3000;
const CHUNK_SIZE = 100;

function cleanText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function cleanKeyPart(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function cleanUrl(value) {
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
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProgramLevel(value) {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (
    [
      "middle school",
      "junior high",
      "jr high",
      "middle_school"
    ].includes(cleaned)
  ) {
    return "middle_school";
  }

  if (
    [
      "club",
      "running club"
    ].includes(cleaned)
  ) {
    return "club";
  }

  return "high_school";
}

function normalizeProgramScope(value) {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (
    [
      "boys",
      "boy",
      "male"
    ].includes(cleaned)
  ) {
    return "boys";
  }

  if (
    [
      "girls",
      "girl",
      "female"
    ].includes(cleaned)
  ) {
    return "girls";
  }

  return "combined";
}

function normalizeRegion(value) {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  const regions = {
    northeast: "Northeast",
    northwest: "Northwest",
    central: "Central",
    southeast: "Southeast",
    southwest: "Southwest"
  };

  return regions[cleaned] || null;
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error(
        "The submitted import data is invalid."
      );

      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function getFirstValue(row, names) {
  for (const name of names) {
    if (
      Object.prototype.hasOwnProperty.call(
        row,
        name
      )
    ) {
      const value = row[name];

      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }
  }

  const lowerEntries = new Map(
    Object.entries(row).map(
      ([key, value]) => [
        String(key)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " "),
        value
      ]
    )
  );

  for (const name of names) {
    const normalizedName = String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");

    if (lowerEntries.has(normalizedName)) {
      const value =
        lowerEntries.get(
          normalizedName
        );

      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }
  }

  return "";
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

function normalizeRow(
  originalRow,
  index,
  defaultSourceName
) {
  const row =
    originalRow &&
    typeof originalRow === "object"
      ? originalRow
      : {};

  const schoolName = cleanText(
    getFirstValue(row, [
      "school_name",
      "School Name",
      "School",
      "Team",
      "Team Name"
    ])
  );

  const city = cleanText(
    getFirstValue(row, [
      "city",
      "City",
      "School City"
    ])
  );

  const state =
    cleanText(
      getFirstValue(row, [
        "state",
        "State"
      ])
    ) || "Ohio";

  const programLevel =
    normalizeProgramLevel(
      getFirstValue(row, [
        "program_level",
        "Program Level",
        "Level",
        "School Level"
      ])
    );

  const programScope =
    normalizeProgramScope(
      getFirstValue(row, [
        "program_scope",
        "Program",
        "Program Scope"
      ])
    );

  const suppliedSchoolKey = cleanText(
    getFirstValue(row, [
      "school_key",
      "School Key"
    ])
  );

  const schoolKey =
    suppliedSchoolKey ||
    buildSchoolKey({
      schoolName,
      city,
      programLevel
    });

  const sourceName =
    cleanText(
      getFirstValue(row, [
        "source_name",
        "Source Name"
      ])
    ) ||
    defaultSourceName;

  const sourceSchoolId = cleanText(
    getFirstValue(row, [
      "source_school_id",
      "Source School ID",
      "School ID",
      "OHSAA School ID",
      "OHSAA ID"
    ])
  );

  const errors = [];

  if (!schoolName) {
    errors.push(
      "School name is required."
    );
  }

  if (!city) {
    errors.push(
      "City is required."
    );
  }

  if (!schoolKey) {
    errors.push(
      "A school key could not be created."
    );
  }

  const athleticsUrlValue =
    getFirstValue(row, [
      "athletics_url",
      "Athletics Website",
      "Athletics URL"
    ]);

  const websiteUrlValue =
    getFirstValue(row, [
      "website_url",
      "School Website",
      "Team Website",
      "Website"
    ]);

  const logoUrlValue =
    getFirstValue(row, [
      "logo_url",
      "Logo URL",
      "Logo"
    ]);

  const athleticsUrl =
    cleanUrl(athleticsUrlValue);

  const websiteUrl =
    cleanUrl(websiteUrlValue);

  const logoUrl =
    cleanUrl(logoUrlValue);

  if (
    cleanText(athleticsUrlValue) &&
    !athleticsUrl
  ) {
    errors.push(
      "Athletics website is invalid."
    );
  }

  if (
    cleanText(websiteUrlValue) &&
    !websiteUrl
  ) {
    errors.push(
      "School website is invalid."
    );
  }

  if (
    cleanText(logoUrlValue) &&
    !logoUrl
  ) {
    errors.push(
      "Logo URL is invalid."
    );
  }

  return {
    row_number: index + 2,
    school_name: schoolName,
    school_key: schoolKey,
    source_name:
      sourceName || null,
    source_school_id:
      sourceSchoolId || null,
    mascot:
      cleanNullableText(
        getFirstValue(row, [
          "mascot",
          "Mascot"
        ])
      ),
    city,
    state,
    zip_code:
      cleanNullableText(
        getFirstValue(row, [
          "zip_code",
          "ZIP Code",
          "Zip",
          "Postal Code"
        ])
      ),
    conference:
      cleanNullableText(
        getFirstValue(row, [
          "conference",
          "Conference",
          "League"
        ])
      ),
    region:
      normalizeRegion(
        getFirstValue(row, [
          "region",
          "Region",
          "Ohio Region"
        ])
      ),
    program_level:
      programLevel,
    program_scope:
      programScope,
    cross_country_boys_division:
      cleanNullableText(
        getFirstValue(row, [
          "cross_country_boys_division",
          "Cross Country Boys Division",
          "XC Boys Division",
          "Boys XC Division"
        ])
      ),
    cross_country_girls_division:
      cleanNullableText(
        getFirstValue(row, [
          "cross_country_girls_division",
          "Cross Country Girls Division",
          "XC Girls Division",
          "Girls XC Division"
        ])
      ),
    track_boys_division:
      cleanNullableText(
        getFirstValue(row, [
          "track_boys_division",
          "Track Boys Division",
          "Boys Track Division"
        ])
      ),
    track_girls_division:
      cleanNullableText(
        getFirstValue(row, [
          "track_girls_division",
          "Track Girls Division",
          "Girls Track Division"
        ])
      ),
    athletics_url: athleticsUrl,
    website_url: websiteUrl,
    logo_url: logoUrl,
    errors
  };
}

function createUniqueSlug(
  row,
  usedSlugs
) {
  const base =
    slugify(
      [
        row.school_name,
        row.city
      ]
        .filter(Boolean)
        .join(" ")
    ) || "team";

  let slug = base;
  let suffix = 2;

  while (usedSlugs.has(slug)) {
    slug =
      base +
      "-" +
      suffix;

    suffix += 1;
  }

  usedSlugs.add(slug);

  return slug;
}

function sourceLookupKey(
  sourceName,
  sourceSchoolId
) {
  const source =
    cleanKeyPart(sourceName);

  const schoolId =
    cleanKeyPart(sourceSchoolId);

  if (!source || !schoolId) {
    return "";
  }

  return source + "|" + schoolId;
}


const IMPORTABLE_FIELDS = new Set([
  "school_name",
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
  "athletics_url",
  "website_url",
  "logo_url"
]);

const DEFAULT_UPDATE_FIELDS = [
  "school_name",
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
  "athletics_url",
  "website_url",
  "logo_url"
];

const FIELD_ALIASES = {
  school_name: ["school_name", "School Name", "School", "Team", "Team Name"],
  mascot: ["mascot", "Mascot"],
  city: ["city", "City", "School City"],
  state: ["state", "State"],
  zip_code: ["zip_code", "ZIP Code", "Zip", "Postal Code"],
  conference: ["conference", "Conference", "League"],
  region: ["region", "Region", "Ohio Region"],
  program_level: ["program_level", "Program Level", "Level", "School Level"],
  program_scope: ["program_scope", "Program", "Program Scope"],
  cross_country_boys_division: [
    "cross_country_boys_division",
    "Cross Country Boys Division",
    "XC Boys Division",
    "Boys XC Division"
  ],
  cross_country_girls_division: [
    "cross_country_girls_division",
    "Cross Country Girls Division",
    "XC Girls Division",
    "Girls XC Division"
  ],
  track_boys_division: [
    "track_boys_division",
    "Track Boys Division",
    "Boys Track Division"
  ],
  track_girls_division: [
    "track_girls_division",
    "Track Girls Division",
    "Girls Track Division"
  ],
  athletics_url: ["athletics_url", "Athletics Website", "Athletics URL"],
  website_url: ["website_url", "School Website", "Team Website", "Website"],
  logo_url: ["logo_url", "Logo URL", "Logo"]
};

function hasMeaningfulValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getPresentFields(originalRow) {
  const present = [];

  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    if (hasMeaningfulValue(getFirstValue(originalRow || {}, aliases))) {
      present.push(field);
    }
  });

  return present;
}

function normalizeUpdateMode(value) {
  return cleanText(value).toLowerCase() === "overwrite_selected"
    ? "overwrite_selected"
    : "fill_missing";
}

function normalizeUpdateFields(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_UPDATE_FIELDS];
  }

  return [
    ...new Set(
      value
        .map((field) => cleanText(field))
        .filter((field) => IMPORTABLE_FIELDS.has(field))
    )
  ];
}

async function loadExistingTeams() {
  const rows = [];
  const pageSize = 1000;
  let start = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("team_pages")
      .select("*")
      .range(start, start + pageSize - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }

    start += pageSize;
  }

  return rows;
}

function selectExistingTeam(team, existingById) {
  if (!team) {
    return null;
  }

  if (team.merged_into_team_id) {
    return existingById.get(team.merged_into_team_id) || team;
  }

  return team;
}

function buildUpdateRecord({
  row,
  existingTeam,
  updateMode,
  updateFields,
  timestamp,
  batchId = null
}) {
  const record = {
    id: existingTeam.id,
    imported_at: timestamp
  };
  const changedFields = [];

  if (
    row.source_name &&
    !hasMeaningfulValue(
      existingTeam.source_name
    )
  ) {
    record.source_name = row.source_name;
    changedFields.push("source_name");
  }

  if (
    row.source_school_id &&
    !hasMeaningfulValue(
      existingTeam.source_school_id
    )
  ) {
    record.source_school_id =
      row.source_school_id;
    changedFields.push(
      "source_school_id"
    );
  }

  if (batchId) {
    record.last_import_batch_id = batchId;
  }

  updateFields.forEach((field) => {
    if (!row.present_fields.includes(field)) {
      return;
    }

    const incoming = row[field];

    if (!hasMeaningfulValue(incoming)) {
      return;
    }

    const current = existingTeam[field];
    const currentMissing =
      !hasMeaningfulValue(current);
    const valuesDiffer =
      String(current ?? "") !==
      String(incoming ?? "");

    if (
      valuesDiffer &&
      (
        updateMode ===
          "overwrite_selected" ||
        currentMissing
      )
    ) {
      record[field] = incoming;
      changedFields.push(field);
    }
  });

  const identityChanged = [
    "school_name",
    "city",
    "program_level"
  ].some((field) =>
    changedFields.includes(field)
  );

  if (
    identityChanged ||
    !hasMeaningfulValue(
      existingTeam.school_key
    )
  ) {
    const finalSchoolKey =
      buildSchoolKey({
        schoolName:
          record.school_name ??
          existingTeam.school_name,
        city:
          record.city ??
          existingTeam.city,
        programLevel:
          record.program_level ??
          existingTeam.program_level
      });

    if (
      finalSchoolKey &&
      finalSchoolKey !==
        existingTeam.school_key
    ) {
      record.school_key = finalSchoolKey;
      changedFields.push("school_key");
    }
  }

  return {
    record,
    changedFields: [
      ...new Set(changedFields)
    ]
  };
}

function buildImportPlan({
  normalizedRows,
  existingTeams,
  publishImportedProfiles,
  updateMode,
  updateFields,
  timestamp
}) {
  const existingBySchoolKey = new Map();
  const existingBySource = new Map();
  const existingById = new Map();
  const usedSlugs = new Set();

  existingTeams.forEach((team) => {
    existingById.set(team.id, team);

    if (team.slug) {
      usedSlugs.add(String(team.slug).toLowerCase());
    }

    if (team.school_key) {
      existingBySchoolKey.set(String(team.school_key).toLowerCase(), team);
    }

    const sourceKey = sourceLookupKey(team.source_name, team.source_school_id);

    if (sourceKey) {
      existingBySource.set(sourceKey, team);
    }
  });

  const seenSchoolKeys = new Set();
  const seenSourceKeys = new Set();
  const plan = [];

  normalizedRows.forEach((row) => {
    const rowErrors = [...row.errors];
    const normalizedSchoolKey = String(row.school_key || "").toLowerCase();
    const rowSourceKey = sourceLookupKey(row.source_name, row.source_school_id);

    if (normalizedSchoolKey && seenSchoolKeys.has(normalizedSchoolKey)) {
      rowErrors.push("This school appears more than once in the upload.");
    }

    if (rowSourceKey && seenSourceKeys.has(rowSourceKey)) {
      rowErrors.push("This source school ID appears more than once in the upload.");
    }

    if (normalizedSchoolKey) {
      seenSchoolKeys.add(normalizedSchoolKey);
    }

    if (rowSourceKey) {
      seenSourceKeys.add(rowSourceKey);
    }

    let existingTeam = null;

    if (rowSourceKey && existingBySource.has(rowSourceKey)) {
      existingTeam = existingBySource.get(rowSourceKey);
    }

    if (!existingTeam && normalizedSchoolKey && existingBySchoolKey.has(normalizedSchoolKey)) {
      existingTeam = existingBySchoolKey.get(normalizedSchoolKey);
    }

    existingTeam = selectExistingTeam(existingTeam, existingById);

    if (existingTeam?.archived_at && !existingTeam?.merged_into_team_id) {
      rowErrors.push("The matching team profile is archived. Restore it before importing updates.");
    }

    if (rowErrors.length > 0) {
      plan.push({
        ...row,
        status: "error",
        existing_team_id: existingTeam?.id || null,
        changed_fields: [],
        errors: rowErrors
      });
      return;
    }

    if (existingTeam) {
      const { record, changedFields } = buildUpdateRecord({
        row,
        existingTeam,
        updateMode,
        updateFields,
        timestamp
      });

      plan.push({
        ...row,
        status: changedFields.length > 0 ? "update" : "unchanged",
        existing_team_id: existingTeam.id,
        existing_slug: existingTeam.slug,
        existing_team: existingTeam,
        update_record: record,
        changed_fields: changedFields,
        errors: []
      });
      return;
    }

    const slug = createUniqueSlug(row, usedSlugs);

    plan.push({
      ...row,
      slug,
      status: "insert",
      existing_team_id: null,
      publish: publishImportedProfiles,
      changed_fields: [
        "school_name",
        "city",
        ...row.present_fields.filter((field) => !["school_name", "city"].includes(field))
      ],
      errors: []
    });
  });

  return plan;
}

function summarizePlan(plan) {
  return {
    total: plan.length,
    insert: plan.filter((row) => row.status === "insert").length,
    update: plan.filter((row) => row.status === "update").length,
    unchanged: plan.filter((row) => row.status === "unchanged").length,
    error: plan.filter((row) => row.status === "error").length,
    skipped: plan.filter((row) => row.status === "skip").length
  };
}

function publicPlanRow(row) {
  return {
    row_number: row.row_number,
    status: row.status,
    school_name: row.school_name,
    city: row.city,
    state: row.state,
    mascot: row.mascot,
    conference: row.conference,
    region: row.region,
    program_level: row.program_level,
    program_scope: row.program_scope,
    school_key: row.school_key,
    source_name: row.source_name,
    source_school_id: row.source_school_id,
    slug: row.slug || row.existing_slug || null,
    existing_team_id: row.existing_team_id,
    changed_fields: row.changed_fields || [],
    errors: row.errors || []
  };
}

async function insertInChunks(table, rows, selectColumns = "id") {
  const inserted = [];

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(chunk)
      .select(selectColumns);

    if (error) {
      throw error;
    }

    inserted.push(...(data || []));
  }

  return inserted;
}

async function commitTeamProfileChanges(insertRows, updateRows) {
  const { data, error } = await supabaseAdmin.rpc(
    "team_commit_import_v1",
    {
      p_insert_rows: insertRows,
      p_update_rows: updateRows
    }
  );

  if (error) {
    throw error;
  }

  const insertedRows = Array.isArray(data?.inserted)
    ? data.inserted
    : [];
  const updatedCount = Number(data?.updated_count);

  if (
    insertedRows.length !== insertRows.length ||
    !Number.isInteger(updatedCount) ||
    updatedCount !== updateRows.length
  ) {
    throw new Error(
      "The database did not confirm every selected team change."
    );
  }

  return {
    insertedRows,
    updatedCount
  };
}

async function writeImportChangeLogs(plan, insertedRows, batch, fileName, sourceName) {
  const insertedBySlug = new Map(
    insertedRows.map((row) => [row.slug, row])
  );
  const logRows = [];

  plan.forEach((row) => {
    if (row.status === "insert") {
      const inserted = insertedBySlug.get(row.slug);

      if (!inserted) {
        return;
      }

      logRows.push({
        team_id: inserted.id,
        actor_type: "import",
        actor_id: "Podium Watch Admin",
        action: "import_create_team",
        summary: "The base team profile was created by a bulk import.",
        changed_fields: row.changed_fields,
        before_data: {},
        after_data: {
          school_name: row.school_name,
          city: row.city,
          slug: row.slug
        },
        metadata: {
          import_batch_id: batch.id,
          file_name: fileName,
          source_name: sourceName,
          row_number: row.row_number
        }
      });
    }

    if (row.status === "update") {
      const beforeData = {};
      const afterData = {};

      row.changed_fields.forEach((field) => {
        beforeData[field] = row.existing_team?.[field] ?? null;
        afterData[field] = row.update_record?.[field] ?? null;
      });

      logRows.push({
        team_id: row.existing_team_id,
        actor_type: "import",
        actor_id: "Podium Watch Admin",
        action: "import_update_team",
        summary: "Selected team fields were updated by a bulk import.",
        changed_fields: row.changed_fields,
        before_data: beforeData,
        after_data: afterData,
        metadata: {
          import_batch_id: batch.id,
          file_name: fileName,
          source_name: sourceName,
          row_number: row.row_number
        }
      });
    }
  });

  if (logRows.length > 0) {
    await insertInChunks("team_change_log", logRows, "id");
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();

    if (!["preview", "commit"].includes(action)) {
      const error = new Error("Choose preview or commit.");
      error.status = 400;
      throw error;
    }

    const submittedRows = Array.isArray(body.rows) ? body.rows : [];

    if (submittedRows.length === 0) {
      const error = new Error("The import does not contain any team rows.");
      error.status = 400;
      throw error;
    }

    if (submittedRows.length > MAX_ROWS) {
      const error = new Error("The import can contain no more than 3000 teams.");
      error.status = 400;
      throw error;
    }

    const fileName = cleanText(body.file_name) || "Team import.csv";
    const sourceName = cleanText(body.source_name) || "Podium Watch Team Import";
    const publishImportedProfiles = body.publish_imported_profiles !== false;
    const updateMode = normalizeUpdateMode(body.update_mode);
    const updateFields = normalizeUpdateFields(body.update_fields);

    if (updateFields.length === 0) {
      const error = new Error(
        "Choose at least one field that existing teams may update."
      );
      error.status = 400;
      throw error;
    }

    const timestamp = new Date().toISOString();

    const normalizedRows = submittedRows.map((row, index) => ({
      ...normalizeRow(row, index, sourceName),
      present_fields: getPresentFields(row)
    }));

    const existingTeams = await loadExistingTeams();
    const plan = buildImportPlan({
      normalizedRows,
      existingTeams,
      publishImportedProfiles,
      updateMode,
      updateFields,
      timestamp
    });
    const summary = summarizePlan(plan);

    if (action === "preview") {
      return response.status(200).json({
        file_name: fileName,
        source_name: sourceName,
        publish_imported_profiles: publishImportedProfiles,
        update_mode: updateMode,
        update_fields: updateFields,
        summary,
        rows: plan.map(publicPlanRow)
      });
    }

    if (body.confirm !== true) {
      const error = new Error("Confirm the import before saving it.");
      error.status = 400;
      throw error;
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("team_import_batches")
      .insert({
        created_by_admin: "Podium Watch Admin",
        file_name: fileName,
        status: "previewed",
        row_count: summary.total,
        inserted_count: 0,
        updated_count: 0,
        skipped_count: summary.skipped + summary.unchanged,
        error_count: summary.error,
        summary: {
          ...summary,
          update_mode: updateMode,
          update_fields: updateFields
        }
      })
      .select("*")
      .single();

    if (batchError) {
      throw batchError;
    }

    try {
      const insertRows = plan
        .filter((row) => row.status === "insert")
        .map((row) => ({
          school_name: row.school_name,
          slug: row.slug,
          school_key: row.school_key,
          source_name: row.source_name,
          source_school_id: row.source_school_id,
          profile_origin: "admin_import",
          imported_at: timestamp,
          last_import_batch_id: batch.id,
          mascot: row.mascot,
          city: row.city,
          state: row.state,
          zip_code: row.zip_code,
          conference: row.conference,
          region: row.region,
          program_level: row.program_level,
          program_scope: row.program_scope,
          cross_country_boys_division: row.cross_country_boys_division,
          cross_country_girls_division: row.cross_country_girls_division,
          track_boys_division: row.track_boys_division,
          track_girls_division: row.track_girls_division,
          athletics_url: row.athletics_url,
          website_url: row.website_url,
          logo_url: row.logo_url,
          published: publishImportedProfiles,
          verified: false,
          suspended: false,
          editing_locked: false
        }));

      const updateRows = plan
        .filter((row) => row.status === "update")
        .map((row) => ({
          ...row.update_record,
          last_import_batch_id: batch.id,
          imported_at: timestamp
        }));

      const {
        insertedRows,
        updatedCount
      } = await commitTeamProfileChanges(
        insertRows,
        updateRows
      );

      const warnings = [];

      try {
        await writeImportChangeLogs(
          plan,
          insertedRows,
          batch,
          fileName,
          sourceName
        );
      } catch (historyError) {
        console.error(
          "The team import completed, but its change history could not be recorded:",
          historyError
        );
        warnings.push(
          "The team profiles were updated, but some import history could not be recorded."
        );
      }

      const committedSummary = {
        ...summary,
        inserted: insertedRows.length,
        updated: updatedCount,
        update_mode: updateMode,
        update_fields: updateFields
      };

      const { error: updateBatchError } = await supabaseAdmin
        .from("team_import_batches")
        .update({
          status: "committed",
          inserted_count: insertedRows.length,
          updated_count: updatedCount,
          skipped_count: summary.skipped + summary.unchanged,
          summary: committedSummary
        })
        .eq("id", batch.id);

      if (updateBatchError) {
        console.error(
          "The team import completed, but its batch record could not be finalized:",
          updateBatchError
        );
        warnings.push(
          "The team profiles were updated, but the import batch record could not be finalized."
        );
      }

      const { error: auditError } = await supabaseAdmin
        .from("team_admin_audit_log")
        .insert({
          admin_identifier: "Podium Watch Admin",
          action: "bulk_team_import",
          import_batch_id: batch.id,
          details: {
            file_name: fileName,
            source_name: sourceName,
            publish_imported_profiles: publishImportedProfiles,
            update_mode: updateMode,
            update_fields: updateFields,
            summary: committedSummary
          }
        });

      if (auditError) {
        console.error(
          "The team import completed, but its admin audit record could not be written:",
          auditError
        );
        warnings.push(
          "The team profiles were updated, but the admin audit record could not be written."
        );
      }

      return response.status(200).json({
        batch_id: batch.id,
        summary: committedSummary,
        warnings,
        rows: plan.map(publicPlanRow)
      });
    } catch (error) {
      await supabaseAdmin
        .from("team_import_batches")
        .update({
          status: "failed",
          summary: {
            ...summary,
            update_mode: updateMode,
            update_fields: updateFields,
            failure: error.message || "Import failed."
          }
        })
        .eq("id", batch.id);

      throw error;
    }
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Admin team import error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The team import could not be completed."
    });
  }
}
