import UrlWriter from "../../_components/url-writer";

export default async function Page({ params }) {
  const { id } = await params;
  return <UrlWriter value={id} />;
}
