"use client";

import type { Area } from "react-easy-crop";
import Cropper from "react-easy-crop";

import { Crop, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProfilePictureFile,
  type ProfilePictureCrop,
} from "@/lib/profile-picture-editor";

type ProfilePictureEditorDialogProps = {
  file: File | null;
  isPending?: boolean;
  open: boolean;
  onConfirm: (file: File) => void;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_CROP = { x: 0, y: 0 };

export function ProfilePictureEditorDialog({
  file,
  isPending = false,
  open,
  onConfirm,
  onOpenChange,
}: ProfilePictureEditorDialogProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<ProfilePictureCrop | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setImageUrl("");
    };
  }, [file]);

  const hasImage = Boolean(file && imageUrl && open);

  async function onApply() {
    if (!file || !imageUrl || !croppedArea) {
      return;
    }

    try {
      setError(null);
      onConfirm(await createProfilePictureFile(file, imageUrl, croppedArea));
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Impossible de preparer l'image.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preparer l&apos;icone</DialogTitle>
          <DialogDescription>Cadre l&apos;image avant de l&apos;utiliser comme photo de profil.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative h-72 overflow-hidden rounded-lg border bg-muted">
            {hasImage ? (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={(_area: Area, areaPixels: Area) => {
                  setCroppedArea(areaPixels);
                }}
                onZoomChange={setZoom}
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <RangeControl
              label="Zoom"
              max={3}
              min={1}
              step={0.05}
              value={zoom}
              onChange={setZoom}
            />
          </div>

          <FormError message={error} />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCrop(DEFAULT_CROP);
              setZoom(1);
            }}
            disabled={isPending}
          >
            <RotateCcw className="size-4" />
            Reinitialiser
          </Button>
          <Button type="button" onClick={onApply} disabled={!croppedArea || isPending}>
            <Crop className="size-4" />
            {isPending ? "Envoi..." : "Utiliser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <Input
        type="range"
        max={max}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
