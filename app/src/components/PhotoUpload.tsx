"use client";

// Ajout de 1 à 3 photos, compressées côté client (canvas) avant envoi en base64.
import { useRef } from "react";

const MAX_PHOTOS = 3;
const MAX_DIMENSION = 1280;

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export default function PhotoUpload({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) break;
      if (!file.type.startsWith("image/")) continue;
      try {
        next.push(await compressImage(file));
      } catch {
        // image illisible : on l'ignore
      }
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <span className="label">Photos du terrain (facultatif, {MAX_PHOTOS} max)</span>
      <div className="flex flex-wrap gap-3">
        {photos.map((src, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Photo ${i + 1}`}
              className="h-20 w-20 rounded-xl border border-leaf-200 object-cover"
            />
            <button
              type="button"
              aria-label="Supprimer la photo"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-leaf-900 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-leaf-300 text-leaf-600"
          >
            <span className="text-2xl leading-none">＋</span>
            <span className="mt-1 text-[11px]">Ajouter</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
