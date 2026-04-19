import RoomJobsClient from "./RoomJobsClient";

export function generateStaticParams() {
  return [{ roomId: "id" }];
}

export default function RoomJobsPage() {
  return <RoomJobsClient />;
}
