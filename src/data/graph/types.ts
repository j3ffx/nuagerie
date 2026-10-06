/**
 * Subset of the Microsoft Graph `driveItem` resource that Nuagerie reads.
 * Every field is optional: `delta` only returns what changed, and some facets
 * (photo, location…) are absent depending on the file.
 * https://learn.microsoft.com/graph/api/resources/driveitem
 */
export interface GraphDriveItem {
  id: string;
  name?: string;
  eTag?: string;
  size?: number;
  parentReference?: { id?: string; driveId?: string; path?: string };
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  photo?: { takenDateTime?: string; cameraMake?: string; cameraModel?: string };
  image?: { width?: number; height?: number };
  video?: { duration?: number; width?: number; height?: number };
  location?: { latitude?: number; longitude?: number; altitude?: number };
  deleted?: { state?: string };
  root?: object;
}
