import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { validateUpload } from "./validation";

export async function saveUpload(file: File) {
  const validationError = validateUpload(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const uploadRoot = process.env.UPLOAD_DIR ?? "./public/uploads";
  const absoluteRoot = path.isAbsolute(uploadRoot) ? uploadRoot : path.join(process.cwd(), uploadRoot);
  await mkdir(absoluteRoot, { recursive: true });

  const extension = path.extname(file.name).toLowerCase();
  const storedName = `${crypto.randomUUID()}${extension}`;
  const absolutePath = path.join(absoluteRoot, storedName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  const isPublic = uploadRoot.includes("public/uploads");
  return {
    filename: file.name,
    storedName,
    mimeType: file.type,
    size: file.size,
    url: isPublic ? `/uploads/${storedName}` : absolutePath
  };
}
