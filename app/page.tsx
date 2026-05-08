import { LandingPage } from "@/components/pages/LandingPage";

// Phase D: ISR — revalidate landing every 10 minutes.
export const revalidate = 600;

export default function Page() {
  return <LandingPage />;
}
