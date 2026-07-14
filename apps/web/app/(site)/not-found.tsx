import NotFound from "@/app/not-found";

// Re-export the root 404 so notFound() thrown inside (site) pages renders it
// WITH the site chrome; the root copy covers fully-unmatched URLs (bare shell).
export default NotFound;
