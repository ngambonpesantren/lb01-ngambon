import { CategoryIndexPage } from "@/components/pages/CategoryIndexPage";

// Phase D: ISR — revalidate category index every 10 minutes.
export const revalidate = 600;

export default function Page() {
  return <CategoryIndexPage />;
}
