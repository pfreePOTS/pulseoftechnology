/**
 * Renders schema.org structured data as a plain `<script>` tag.
 *
 * Deliberately not `next/script`: deferred strategies can run after a crawler
 * has already read the DOM, and structured data is only useful if it is there
 * when the page is parsed.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Escaping `<` stops a `</script>` sequence inside any string field from
      // closing the tag early. Input is build-time constant, never user data.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
