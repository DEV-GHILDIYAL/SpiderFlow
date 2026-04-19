import JobDetailClient from "./JobDetailClient";

export function generateStaticParams() {
  return [{ roomId: "id", jobId: "id" }];
}

export default function JobDetailPage() {
  return <JobDetailClient />;
}
