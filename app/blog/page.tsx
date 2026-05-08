import { BlogListPage } from "@/components/pages/BlogListPage";

// Phase D: ISR — revalidate blog list every 10 minutes.
export const revalidate = 600;

export default function Page() {
  return <BlogListPage />;
}
