import Image from "next/image";
import logoForest from "@/images/adventist-symbol-circle--forest.png";
import logoWhite from "@/images/adventist-symbol-circle--white.png";

export function Brand({
  compact = false,
  tone = "default"
}: {
  compact?: boolean;
  tone?: "default" | "light";
}) {
  const logo = tone === "light" ? logoWhite : logoForest;

  return (
    <div className={`brand brand-${tone}`} aria-label="SDA Service Request Tracker">
      <div className={`brand-mark ${compact ? "small" : ""}`}>
        <Image
          alt=""
          aria-hidden="true"
          className="brand-logo"
          priority={!compact}
          sizes={compact ? "34px" : "42px"}
          src={logo}
        />
      </div>
      <div className="brand-text">
        <strong>SDA Service Request Tracker</strong>
        {!compact ? <span>Service approvals and visibility</span> : null}
      </div>
    </div>
  );
}
