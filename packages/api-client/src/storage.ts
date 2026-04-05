// Presigned URL pattern: the API generates a signed upload URL,
// the client uploads the binary directly to Supabase Storage.
// This means the FastAPI server never handles file bytes.
import { apiClient } from "./client";

export interface PresignedUrlResponse {
  upload_url: string;   // PUT this URL with the file binary
  public_url: string;   // Use this URL to reference the file afterwards
  expires_in: number;   // seconds
}

export const storageApi = {
  presign: (bucket: string, path: string, contentType: string) =>
    apiClient
      .post<PresignedUrlResponse>("/storage/presign", {
        bucket,
        path,
        content_type: contentType,
      })
      .then((r) => r.data),

  // Upload a file using the presigned URL (direct to Supabase Storage)
  uploadToPresignedUrl: async (
    uploadUrl: string,
    file: Blob | File,
    contentType: string
  ): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Storage upload failed: ${response.statusText}`);
    }
  },
};
