"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useSettings } from "@/stores/settings";
import { playAnswer } from "@/lib/sound";

/**
 * Mute switch for the answer sounds. Needed next to the feature itself: a
 * quiz gets played in classrooms, on buses and next to sleeping siblings, and
 * hunting for the OS volume mid-round is not an answer.
 *
 * Renders a neutral icon until mounted — the value comes from localStorage, so
 * markup rendered on the server can't know it yet.
 */
export function SoundToggle({
  compact = false,
  className = "",
}: {
  /** small square variant used in the footer strip */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("settings");
  const sound = useSettings((s) => s.sound);
  const toggleSound = useSettings((s) => s.toggleSound);
  const [mounted, setMounted] = useState(false);
  // one-shot mount flag: the persisted value only exists on the client, so the
  // first render must match the server's (sound off) or hydration mismatches.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- no cascade: fires once
  useEffect(() => setMounted(true), []);

  const on = mounted && sound;

  return (
    <Toggle
      pressed={on}
      size={compact ? "iconSm" : "icon"}
      onPressedChange={() => {
        toggleSound();
        // turning it ON plays a sample, so you hear what you just enabled —
        // and the click doubles as the gesture that unlocks the audio context
        if (!sound) playAnswer(true);
      }}
      aria-label={t("sound")}
      title={on ? t("soundOn") : t("soundOff")}
      className={className}
    >
      {on ? <Volume2 size={compact ? 14 : 17} /> : <VolumeX size={compact ? 14 : 17} />}
    </Toggle>
  );
}
