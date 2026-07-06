export type ProfilePictureCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PROFILE_PICTURE_SIZE = 512;
const PROFILE_PICTURE_TYPE = "image/jpeg";
const PROFILE_PICTURE_QUALITY = 0.9;

export function loadProfilePictureImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("Impossible de charger l'image."));
    };
    image.src = src;
  });
}

export async function createProfilePictureFile(
  source: File,
  imageSrc: string,
  crop: ProfilePictureCrop,
) {
  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_PICTURE_SIZE;
  canvas.height = PROFILE_PICTURE_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de preparer l'image.");
  }

  const image = await loadProfilePictureImage(imageSrc);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, PROFILE_PICTURE_SIZE, PROFILE_PICTURE_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    PROFILE_PICTURE_SIZE,
    PROFILE_PICTURE_SIZE,
  );

  const blob = await getCanvasBlob(canvas);
  return new File([blob], getEditedFileName(source.name), {
    type: PROFILE_PICTURE_TYPE,
    lastModified: Date.now(),
  });
}

function getCanvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Impossible de preparer l'image."));
      },
      PROFILE_PICTURE_TYPE,
      PROFILE_PICTURE_QUALITY,
    );
  });
}

function getEditedFileName(fileName: string) {
  const name = fileName.replace(/\.[^.]+$/, "") || "profile-picture";
  return `${name}-icon.jpg`;
}
