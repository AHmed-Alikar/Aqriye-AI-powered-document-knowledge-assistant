const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "documents";

const isEnabled = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabase = isEnabled
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Uploads a just-received file to Supabase Storage when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are configured; otherwise keeps today's local-
// disk behavior unchanged (returns the local temp path as-is). Local disk
// is not reliable in production - most hosts wipe it on redeploy/restart -
// so this activates automatically the moment those two env vars are set,
// with zero code changes needed elsewhere.
async function storeUploadedFile(localTempPath, originalName) {
  if (!isEnabled) {
    return localTempPath;
  }

  const buffer = fs.readFileSync(localTempPath);
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: "application/pdf",
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  fs.unlinkSync(localTempPath);

  return `supabase://${BUCKET}/${key}`;
}

// Reads a stored file back into memory regardless of whether
// storeUploadedFile put it on local disk or in Supabase Storage.
async function readStoredFile(fileRef) {
  if (fileRef.startsWith("supabase://")) {
    if (!isEnabled) {
      throw new Error(
        "Document is stored in Supabase Storage but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured"
      );
    }

    const key = fileRef.replace(`supabase://${BUCKET}/`, "");
    const { data, error } = await supabase.storage.from(BUCKET).download(key);

    if (error) {
      throw new Error(`Supabase Storage download failed: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  return fs.readFileSync(fileRef);
}

module.exports = {
  isEnabled,
  storeUploadedFile,
  readStoredFile,
};
