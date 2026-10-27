import { LoaderCircle } from "lucide-react";

export function BusyIcon() { return <LoaderCircle className="tv-spinner" aria-hidden="true" />; }
export default function LoadingStatus({ children }: { children: React.ReactNode }) {
  return <p className="tv-loading-status" role="status"><BusyIcon /><span>{children}</span></p>;
}
