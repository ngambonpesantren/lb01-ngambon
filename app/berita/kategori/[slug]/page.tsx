import { CategoryPage } from "@/components/pages/CategoryPage";

// Phase D: ISR — revalidate category pages every 10 minutes.
export const revalidate = 600;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return null;
  return <CategoryPage slug={slug} />;
}
