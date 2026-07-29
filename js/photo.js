import { api } from './api.js';

// Resize/compress a captured photo client-side before upload so free-tier
// storage and bandwidth (Cloudinary) last across many players and cycles.
export function compressImage(file, maxDimension = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compression échouée'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image"));
    };
    img.src = url;
  });
}

let cloudinaryConfigPromise = null;
function getCloudinaryConfig() {
  if (!cloudinaryConfigPromise) cloudinaryConfigPromise = api.get('/api/config');
  return cloudinaryConfigPromise;
}

export async function uploadPhoto(file) {
  const { cloudName, uploadPreset } = await getCloudinaryConfig();
  if (!cloudName || !uploadPreset) {
    throw new Error("L'hébergement des photos n'est pas configuré (Cloudinary manquant)");
  }
  const blob = await compressImage(file);
  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Échec de l'envoi de la photo");
  return data.secure_url;
}
