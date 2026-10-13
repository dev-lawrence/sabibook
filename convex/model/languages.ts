export type Language = "en" | "pcm" | "yo" | "ha" | "ig";

export const LANGUAGES: Record<
  Language,
  {
    label: string;
    beta: boolean;
    // Code sent to the ASR server. Whisper has no token for Pidgin or Igbo,
    // so those let the model detect the language itself.
    asrCode?: string;
    // Which ASR model family handles this language best.
    asrTrack: "english" | "naija";
    promptName: string;
  }
> = {
  en: { label: "English", beta: false, asrCode: "en", asrTrack: "english", promptName: "English" },
  pcm: { label: "Pidgin", beta: false, asrTrack: "naija", promptName: "Nigerian Pidgin" },
  yo: { label: "Yorùbá", beta: true, asrCode: "yo", asrTrack: "naija", promptName: "Yoruba" },
  ha: { label: "Hausa", beta: true, asrCode: "ha", asrTrack: "naija", promptName: "Hausa" },
  ig: { label: "Igbo", beta: true, asrTrack: "naija", promptName: "Igbo" },
};
