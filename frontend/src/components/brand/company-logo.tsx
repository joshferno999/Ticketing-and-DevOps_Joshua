import { cn } from "../../lib/utils";

type CompanyLogoProps = {
  className?: string;
  imageClassName?: string;
  alt?: string;
};

export function CompanyLogo({ className, imageClassName, alt = "Emergence Devops" }: CompanyLogoProps) {
  return (
    <span className={cn("inline-flex items-center justify-center overflow-hidden rounded-xl bg-inverse-surface", className)}>
      <img className={cn("h-full w-full object-contain", imageClassName)} src="/logo-no-bg.png" alt={alt} />
    </span>
  );
}
