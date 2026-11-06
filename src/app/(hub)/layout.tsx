import { HubShell } from "@/components/shell";

export default function HubLayout({ children }: LayoutProps<"/">) {
  return <HubShell>{children}</HubShell>;
}
