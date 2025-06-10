import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function HeadphoneWarning() {
  const { t } = useTranslation();
  return (
    <div className="mt-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
      <Volume2 className="h-5 w-5 text-amber-800 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-amber-800">
        {t("recordingModal.microphone.headphoneWarning")}
      </p>
    </div>
  );
} 